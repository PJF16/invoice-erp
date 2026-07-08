import SwiftUI

@main
struct LagerScannerApp: App {
    @StateObject private var api = APIClient()

    var body: some Scene {
        WindowGroup {
            if api.isLoggedIn {
                MainView()
                    .environmentObject(api)
            } else {
                LoginView()
                    .environmentObject(api)
            }
        }
    }
}
