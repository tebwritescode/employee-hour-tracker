import SwiftUI
import Combine

struct AuthenticationView: View {
    @StateObject private var viewModel = AuthenticationViewModel()
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                VStack {
                    Image(systemName: "clock.badge.checkmark")
                        .font(.system(size: 64))
                        .foregroundColor(.blue)
                    
                    Text("Employee Hour Tracker")
                        .font(.title)
                        .fontWeight(.bold)
                    
                    Text("Sign in to continue")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding(.bottom, 30)
                
                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Username")
                            .font(.headline)
                        TextField("Enter username", text: $viewModel.username)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .autocapitalization(.none)
                            .disableAutocorrection(true)
                    }
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Password")
                            .font(.headline)
                        SecureField("Enter password", text: $viewModel.password)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                    }
                    
                    if let errorMessage = viewModel.errorMessage {
                        Text(errorMessage)
                            .foregroundColor(.red)
                            .font(.caption)
                            .padding(.horizontal)
                    }
                    
                    Button(action: viewModel.login) {
                        HStack {
                            if viewModel.isLoading {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .scaleEffect(0.8)
                            } else {
                                Text("Sign In")
                                    .fontWeight(.semibold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                    }
                    .disabled(viewModel.isLoading || viewModel.username.isEmpty || viewModel.password.isEmpty)
                }
                .padding(.horizontal, 32)
                
                Spacer()
                
                VStack(spacing: 12) {
                    Button("Server Settings") {
                        viewModel.showServerSettings = true
                    }
                    .foregroundColor(.blue)
                    
                    Button("Use Default Credentials") {
                        viewModel.resetToDefaults()
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)
                }
            }
            .padding()
            .navigationTitle("")
            .navigationBarHidden(true)
        }
        .sheet(isPresented: $viewModel.showServerSettings) {
            ServerSettingsView(viewModel: viewModel)
        }
        .onReceive(Just(viewModel.username)) { _ in
            viewModel.clearError()
        }
        .onReceive(Just(viewModel.password)) { _ in
            viewModel.clearError()
        }
    }
}

struct ServerSettingsView: View {
    @ObservedObject var viewModel: AuthenticationViewModel
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        NavigationView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Server URL")
                        .font(.headline)
                    
                    TextField("http://localhost:3000", text: $viewModel.serverURL)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                        .keyboardType(.URL)
                    
                    Text("Enter the base URL of your Employee Hour Tracker server")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                if let errorMessage = viewModel.errorMessage {
                    Text(errorMessage)
                        .foregroundColor(.red)
                        .font(.caption)
                }
                
                Spacer()
            }
            .padding()
            .navigationTitle("Server Settings")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                leading: Button("Cancel") {
                    presentationMode.wrappedValue.dismiss()
                },
                trailing: Button("Save") {
                    viewModel.updateServerURL()
                    if viewModel.errorMessage == nil {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
            )
        }
    }
}

#Preview {
    AuthenticationView()
}