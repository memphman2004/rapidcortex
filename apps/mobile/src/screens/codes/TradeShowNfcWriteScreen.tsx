import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/common/Button";
import { QRDisplay, type QRCodeRef } from "@/components/venue/QRDisplay";
import {
  isTradeShowMarketingUrl,
  TRADE_SHOW_DESTINATIONS,
  tradeShowQrFileName,
  tradeShowScanUrl,
  type TradeShowDestinationId,
} from "@/lib/trade-show-nfc";
import {
  cancelNfcSession,
  isNFCSupported,
  nfcErrorMessage,
  writeURLToTag,
  type NFCWriteError,
} from "@/services/nfc";
import { useTheme } from "@/theme";
import { Strings } from "@/utils/strings";

type Step = "checking" | "ready" | "writing" | "success" | "error";

const ERROR_MESSAGE: Record<NFCWriteError, string> = {
  UNSUPPORTED: Strings.venue.nfcWrite.errors.unsupported,
  PERMISSION_DENIED: Strings.venue.nfcWrite.errors.permissionDenied,
  TIMEOUT: Strings.venue.nfcWrite.errors.timeout,
  TAG_INCOMPATIBLE: Strings.venue.nfcWrite.errors.tagIncompatible,
  WRITE_FAILED: Strings.venue.nfcWrite.errors.writeFailed,
  CANCELLED: Strings.venue.nfcWrite.errors.cancelled,
};

function base64FromDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export default function TradeShowNfcWriteScreen() {
  const router = useRouter();
  const qrRef = useRef<QRCodeRef | null>(null);
  const { colors, typography, spacing } = useTheme();
  const palette = colors as {
    background: string;
    textPrimary: string;
    textSecondary: string;
    amber: string;
    red: string;
    border: string;
    surface: string;
  };

  const [destination, setDestination] = useState<TradeShowDestinationId>("home");
  const url = tradeShowScanUrl(destination, "nfc");
  const [nfcSupported, setNfcSupported] = useState(true);
  const [step, setStep] = useState<Step>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bytesWritten, setBytesWritten] = useState(0);

  useEffect(() => {
    void isNFCSupported().then((supported) => {
      setNfcSupported(supported);
      setStep("ready");
      if (!supported) {
        setErrorMessage(nfcErrorMessage("UNSUPPORTED"));
      }
    });

    return () => {
      void cancelNfcSession();
    };
  }, []);

  const handleWrite = async () => {
    if (!isTradeShowMarketingUrl(url)) {
      setErrorMessage(Strings.common.somethingWentWrong);
      setStep("error");
      return;
    }

    setStep("writing");
    setErrorMessage(null);

    const result = await writeURLToTag(url);
    if (!result.success) {
      setErrorMessage(ERROR_MESSAGE[result.error ?? "WRITE_FAILED"]);
      setStep("error");
      return;
    }

    setBytesWritten(result.bytesWritten ?? 0);
    setStep("success");
  };

  const pngName = tradeShowQrFileName(destination);

  const handleSaveQr = async () => {
    if (!qrRef.current) return;
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(Strings.common.noPermission);
      return;
    }
    qrRef.current.toDataURL(async (dataUrl) => {
      try {
        const fileUri = `${FileSystem.cacheDirectory}${pngName}`;
        await FileSystem.writeAsStringAsync(fileUri, base64FromDataUrl(dataUrl), {
          encoding: "base64",
        });
        await MediaLibrary.saveToLibraryAsync(fileUri);
        Alert.alert(Strings.venue.signPackage.saveToPhotos, "Saved to Photos.");
      } catch {
        Alert.alert(Strings.common.somethingWentWrong);
      }
    });
  };

  const handleShareQr = async () => {
    if (!qrRef.current) return;
    qrRef.current.toDataURL(async (dataUrl) => {
      try {
        const fileUri = `${FileSystem.cacheDirectory}${pngName}`;
        await FileSystem.writeAsStringAsync(fileUri, base64FromDataUrl(dataUrl), {
          encoding: "base64",
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: "image/png" });
        }
      } catch {
        Alert.alert(Strings.common.somethingWentWrong);
      }
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={["top"]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing["5"],
          paddingTop: spacing["4"],
        }}
      >
        <Pressable onPress={() => router.back()}>
          <Text style={[typography.h3, { color: palette.amber }]}>‹ {Strings.common.close}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing["5"], paddingBottom: spacing["10"] }}>
        <Text style={[typography.h1, { color: palette.textPrimary, textAlign: "center" }]}>
          {Strings.venue.tradeShowNfc.title}
        </Text>
        <Text
          style={[
            typography.body,
            { color: palette.textSecondary, textAlign: "center", marginTop: spacing["2"] },
          ]}
        >
          {Strings.venue.tradeShowNfc.blurb}
        </Text>

        <View style={{ flexDirection: "row", gap: 8, marginTop: spacing["5"] }}>
          {TRADE_SHOW_DESTINATIONS.map((dest) => {
            const selected = dest.id === destination;
            return (
              <Pressable
                key={dest.id}
                onPress={() => {
                  setDestination(dest.id);
                  setStep("ready");
                  setErrorMessage(nfcSupported ? null : nfcErrorMessage("UNSUPPORTED"));
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: selected ? palette.amber : palette.border,
                  backgroundColor: selected ? palette.surface : "transparent",
                  borderRadius: 10,
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                }}
              >
                <Text
                  style={[
                    typography.bodyMedium,
                    { color: selected ? palette.amber : palette.textPrimary, textAlign: "center" },
                  ]}
                >
                  {dest.id === "home"
                    ? Strings.venue.tradeShowNfc.homeLabel
                    : Strings.venue.tradeShowNfc.demoLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text
          style={[
            typography.caption,
            { color: palette.amber, textAlign: "center", marginTop: spacing["3"] },
          ]}
        >
          {url.replace(/^https:\/\//, "")}
        </Text>

        <View style={{ alignItems: "center", marginTop: spacing["5"] }}>
          <QRDisplay value={url} size={200} qrRef={qrRef} />
        </View>
        <Text
          style={[
            typography.caption,
            { color: palette.textSecondary, textAlign: "center", marginTop: spacing["3"] },
          ]}
        >
          {Strings.venue.signPackage.printMinSize}
        </Text>

        <View style={{ marginTop: spacing["4"], gap: spacing["3"] }}>
          <Button
            title={Strings.venue.signPackage.saveToPhotos}
            variant="secondary"
            onPress={() => void handleSaveQr()}
          />
          <Button
            title={Strings.venue.signPackage.shareQr}
            variant="secondary"
            onPress={() => void handleShareQr()}
          />
        </View>

        {step === "checking" ? (
          <ActivityIndicator size="large" color={palette.amber} style={{ marginTop: spacing["6"] }} />
        ) : null}

        {step === "ready" ? (
          <View style={{ marginTop: spacing["6"], gap: spacing["3"] }}>
            <Text style={[typography.body, { color: palette.textSecondary, textAlign: "center" }]}>
              {nfcSupported ? Strings.venue.tradeShowNfc.ready : errorMessage}
            </Text>
            <Button
              title={Strings.venue.tradeShowNfc.program}
              onPress={() => void handleWrite()}
              disabled={!nfcSupported}
            />
          </View>
        ) : null}

        {step === "writing" ? (
          <View style={{ alignItems: "center", gap: spacing["4"], marginTop: spacing["6"] }}>
            <ActivityIndicator size="large" color={palette.amber} />
            <Text style={[typography.body, { color: palette.textSecondary }]}>
              {Strings.venue.tradeShowNfc.writing}
            </Text>
          </View>
        ) : null}

        {step === "success" ? (
          <View style={{ alignItems: "center", gap: spacing["4"], marginTop: spacing["6"] }}>
            <Text style={{ fontSize: 48 }}>✅</Text>
            <Text style={[typography.h2, { color: palette.textPrimary, textAlign: "center" }]}>
              {Strings.venue.tradeShowNfc.success}
            </Text>
            <Text style={[typography.caption, { color: palette.textSecondary }]}>
              {bytesWritten} bytes · {url.replace(/^https:\/\//, "")}
            </Text>
            <Button
              title={Strings.venue.nfcWrite.writeAnother}
              variant="secondary"
              onPress={() => setStep("ready")}
            />
          </View>
        ) : null}

        {step === "error" ? (
          <View style={{ alignItems: "center", gap: spacing["4"], marginTop: spacing["6"] }}>
            <Text style={{ fontSize: 48 }}>⚠️</Text>
            <Text style={[typography.body, { color: palette.red, textAlign: "center" }]}>
              {errorMessage}
            </Text>
            <Button title={Strings.common.retry} onPress={() => setStep("ready")} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
