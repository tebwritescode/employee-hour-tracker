import SwiftUI
import Combine

struct ContentView: View {
    @EnvironmentObject private var apiService: APIService
    @EnvironmentObject private var dataStore: DataStore
    @State private var selectedTab = 2  // Start with Analytics (Overview) tab
    @State private var showingLogin = false
    @State private var cancellables = Set<AnyCancellable>()
    
    var body: some View {
        TabView(selection: $selectedTab) {
            // Analytics (Overview) - Main focus of the app
            AnalyticsView()
                .tabItem {
                    Image(systemName: "chart.bar.fill")
                    Text("Overview")
                }
                .tag(2)
            
            // Time Tracking - Read-only view
            TimeTrackingView()
                .tabItem {
                    Image(systemName: "clock.fill")
                    Text("Time Tracking")
                }
                .tag(0)
            
            // Settings and optional login
            SettingsView()
                .tabItem {
                    Image(systemName: "gear")
                    Text("Settings")
                }
                .tag(3)
        }
        .sheet(isPresented: $showingLogin) {
            AuthenticationView()
        }
        .onAppear {
            // Check authentication status but don't require login
            apiService.checkAuth()
                .sink(receiveCompletion: { _ in },
                      receiveValue: { _ in })
                .store(in: &cancellables)
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(APIService.shared)
        .environmentObject(DataStore.shared)
}