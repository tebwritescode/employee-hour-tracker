import SwiftUI

@main
struct EmployeeTrackerApp: App {
    @StateObject private var apiService = APIService.shared
    @StateObject private var dataStore = DataStore.shared
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(apiService)
                .environmentObject(dataStore)
        }
    }
}