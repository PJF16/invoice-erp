import SwiftUI
import VisionKit

/// Barcode-Scanner auf Basis von VisionKit (DataScannerViewController).
/// Auf dem Simulator gibt es keine Kamera — dort bleibt die Fläche leer,
/// der Barcode kann manuell eingegeben werden.
struct BarcodeScannerView: UIViewControllerRepresentable {
    let onScan: (String) -> Void

    func makeUIViewController(context: Context) -> UIViewController {
        guard DataScannerViewController.isSupported, DataScannerViewController.isAvailable else {
            let fallback = UIViewController()
            fallback.view.backgroundColor = .black
            return fallback
        }
        let scanner = DataScannerViewController(
            recognizedDataTypes: [.barcode()],
            qualityLevel: .balanced,
            recognizesMultipleItems: false,
            isHighlightingEnabled: true
        )
        scanner.delegate = context.coordinator
        try? scanner.startScanning()
        return scanner
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onScan: onScan)
    }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let onScan: (String) -> Void
        private var lastCode: String?
        private var lastScan = Date.distantPast

        init(onScan: @escaping (String) -> Void) {
            self.onScan = onScan
        }

        func dataScanner(_ dataScanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
            for case let .barcode(barcode) in addedItems {
                guard let code = barcode.payloadStringValue else { continue }
                // Denselben Code nicht mehrfach hintereinander feuern
                if code == lastCode && Date().timeIntervalSince(lastScan) < 3 { continue }
                lastCode = code
                lastScan = Date()
                onScan(code)
            }
        }
    }
}
