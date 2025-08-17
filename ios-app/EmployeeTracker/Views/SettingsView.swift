import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var apiService: APIService
    @EnvironmentObject private var dataStore: DataStore
    @State private var serverURL = ""
    @State private var showingLogoutAlert = false
    
    var body: some View {
        NavigationView {
            Form {
                Section("Server Configuration") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Server URL")
                            .font(.headline)
                        
                        TextField("http://localhost:3000", text: $serverURL)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .autocapitalization(.none)
                            .disableAutocorrection(true)
                            .keyboardType(.URL)
                        
                        Button("Update Server URL") {
                            updateServerURL()
                        }
                        .disabled(serverURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                    .padding(.vertical, 4)
                }
                
                Section("Account") {
                    if apiService.isAuthenticated {
                        Button("Sign Out") {
                            showingLogoutAlert = true
                        }
                        .foregroundColor(.red)
                    } else {
                        Button("Sign In (Optional)") {
                            // Show login sheet - but make it clear it's optional
                        }
                        .foregroundColor(.blue)
                        
                        Text("Sign in to enable data management features")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                Section("About") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Employee Hour Tracker")
                            .font(.headline)
                        
                        Text("iOS companion app for viewing time tracking data")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Text("Version 1.0")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 4)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.large)
        }
        .alert("Sign Out", isPresented: $showingLogoutAlert) {
            Button("Cancel", role: .cancel) { }
            Button("Sign Out", role: .destructive) {
                logout()
            }
        } message: {
            Text("Are you sure you want to sign out?")
        }
        .onAppear {
            serverURL = dataStore.getServerURL()
        }
    }
    
    private func updateServerURL() {
        let cleanURL = serverURL.trimmingCharacters(in: .whitespacesAndNewlines)
        dataStore.setServerURL(cleanURL)
        apiService.updateBaseURL(cleanURL)
    }
    
    private func logout() {
        apiService.logout()
            .sink(receiveCompletion: { _ in },
                  receiveValue: { _ in })
            .store(in: &Set<AnyCancellable>())
    }
}

#Preview {
    SettingsView()
        .environmentObject(APIService.shared)
        .environmentObject(DataStore.shared)
}