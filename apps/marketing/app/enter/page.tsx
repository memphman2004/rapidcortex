"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { EnterTheCortexClient } from "@/app/(marketing)/enter/_client";

const MOBILE_UA =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

export default function EnterPage() {
  const router = useRouter();

  useEffect(() => {
    if (MOBILE_UA.test(navigator.userAgent)) router.replace("/");
  }, [router]);

  return <EnterTheCortexClient />;
}
