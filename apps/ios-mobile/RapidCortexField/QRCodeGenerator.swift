import CoreImage
import CoreImage.CIFilterBuiltins
import UIKit

enum QRCodeGenerator {
    private static let logoCache = NSCache<NSString, UIImage>()

    /// Print-ready QR (1024px). Uses error-correction H when a center logo is present so scanners still read.
    static func generate(url: URL, size: CGFloat = 1024, centerLogo: UIImage? = nil) -> UIImage? {
        guard let data = url.absoluteString.data(using: .utf8) else { return nil }

        let filter = CIFilter.qrCodeGenerator()
        filter.message = data
        filter.correctionLevel = centerLogo == nil ? "M" : "H"
        guard let ciImage = filter.outputImage else { return nil }

        let extent = ciImage.extent
        guard extent.width > 1, extent.height > 1 else { return nil }

        let quiet = size * 0.08
        let qrSide = size - quiet * 2
        let scale = qrSide / extent.width
        var scaled = ciImage.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        scaled = scaled.transformed(
            by: CGAffineTransform(translationX: -scaled.extent.origin.x, y: -scaled.extent.origin.y)
        )

        let ciContext = CIContext(options: [.useSoftwareRenderer: false])
        guard let cgImage = ciContext.createCGImage(scaled, from: scaled.extent) else { return nil }

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
        return renderer.image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(origin: .zero, size: CGSize(width: size, height: size)))

            let qrRect = CGRect(x: quiet, y: quiet, width: qrSide, height: qrSide)
            ctx.cgContext.interpolationQuality = .none
            UIImage(cgImage: cgImage).draw(in: qrRect)

            if let logo = centerLogo {
                drawCenterLogo(logo, in: ctx.cgContext, canvas: size)
            }
        }
    }

    static func pngData(url: URL, size: CGFloat = 1024, centerLogo: UIImage? = nil) -> Data? {
        generate(url: url, size: size, centerLogo: centerLogo)?.pngData()
    }

    static func filename(for code: QRNFCCode) -> String {
        let safeName = code.name
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
            .prefix(40)
        let shortId = String(code.qrId.prefix(8))
        return "rc-qr-\(safeName)-\(shortId).png"
    }

    /// Agency branding logo if available; otherwise the Rapid Cortex mark.
    static func fallbackLogo() -> UIImage? {
        UIImage(named: "RCLogo")
    }

    static func cachedLogo(for agencyId: String) -> UIImage? {
        guard !agencyId.isEmpty else { return nil }
        return logoCache.object(forKey: agencyId as NSString)
    }

    static func storeLogo(_ image: UIImage, for agencyId: String) {
        guard !agencyId.isEmpty else { return }
        logoCache.setObject(image, forKey: agencyId as NSString)
    }

    static func loadRemoteLogo(from urlString: String?) async -> UIImage? {
        guard let raw = urlString?.trimmingCharacters(in: .whitespacesAndNewlines),
              let url = URL(string: raw),
              let scheme = url.scheme?.lowercased(),
              scheme == "https" || scheme == "http"
        else { return nil }

        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
                return nil
            }
            return UIImage(data: data)
        } catch {
            return nil
        }
    }

    private static func drawCenterLogo(_ logo: UIImage, in cg: CGContext, canvas size: CGFloat) {
        // ~18% of the canvas (~21% of the QR) stays within error-correction H recovery.
        let logoSide = size * 0.18
        let pad = size * 0.016
        let badge = CGRect(
            x: (size - logoSide) / 2,
            y: (size - logoSide) / 2,
            width: logoSide,
            height: logoSide
        )
        let plate = badge.insetBy(dx: -pad, dy: -pad)
        let platePath = UIBezierPath(roundedRect: plate, cornerRadius: plate.width * 0.22)
        UIColor.white.setFill()
        platePath.fill()

        cg.saveGState()
        let clip = UIBezierPath(roundedRect: badge, cornerRadius: badge.width * 0.18)
        cg.addPath(clip.cgPath)
        cg.clip()
        logo.draw(in: aspectFit(logo.size, in: badge))
        cg.restoreGState()
    }

    private static func aspectFit(_ imageSize: CGSize, in rect: CGRect) -> CGRect {
        guard imageSize.width > 0, imageSize.height > 0 else { return rect }
        let scale = min(rect.width / imageSize.width, rect.height / imageSize.height)
        let w = imageSize.width * scale
        let h = imageSize.height * scale
        return CGRect(
            x: rect.midX - w / 2,
            y: rect.midY - h / 2,
            width: w,
            height: h
        )
    }
}
