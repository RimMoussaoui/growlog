"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as AuthService from "../services/auth"
import { isOnline } from "../services/network"
import NetworkStatus from "../components/NetworkStatus"

const LoginScreen = ({ navigation, onLoginSuccess }) => {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loginAttempts, setLoginAttempts] = useState(0)

  // Vérifier l'état de la connexion au chargement
  useEffect(() => {
    const checkNetworkStatus = async () => {
      try {
        const online = await isOnline()
        setIsOfflineMode(!online)
      } catch (error) {
        console.error("Erreur lors de la vérification de la connexion:", error)
        setIsOfflineMode(true)
      }
    }

    checkNetworkStatus()

    // Vérifier périodiquement l'état de la connexion
    const networkInterval = setInterval(checkNetworkStatus, 10000)

    // Récupérer la dernière tentative de connexion
    const getLastAttempt = async () => {
      try {
        const lastAttempt = await AuthService.getLastLoginAttempt()
        if (lastAttempt && lastAttempt.email) {
          setEmail(lastAttempt.email)
        }
      } catch (error) {
        console.error("Erreur lors de la récupération de la dernière tentative:", error)
      }
    }

    getLastAttempt()

    return () => clearInterval(networkInterval)
  }, [])

  // Fonction pour gérer la connexion
  const handleLogin = async () => {
    try {
      // Validation des champs
      if (!email.trim()) {
        setError("L'email est requis")
        return
      }

      if (!password.trim()) {
        setError("Le mot de passe est requis")
        return
      }

      setLoading(true)
      setError("")

      // Appel au service d'authentification
      const user = await AuthService.loginUser(email, password)

      // Succès
      if (onLoginSuccess) {
        onLoginSuccess()
      }
    } catch (error) {
      console.error("Erreur lors de la connexion:", error)
      setError(error.message || "Échec de la connexion")
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 50 : 0}
    >
      <NetworkStatus />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.logoContainer}>
          <View style={styles.logoIconContainer}>
            <Ionicons name="leaf" size={80} color="#6ca81f" />
          </View>
          <Text style={styles.appName}>GrowLog</Text>
          <Text style={styles.appSlogan}>Suivez et gérez vos oliviers</Text>
        </View>

        {isOfflineMode && (
          <View style={styles.offlineWarning}>
            <Ionicons name="cloud-offline" size={20} color="#FFC107" />
            <Text style={styles.offlineWarningText}>
              Mode hors ligne - Connexion avec identifiants locaux uniquement
            </Text>
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail" size={20} color="#AAAAAA" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color="#AAAAAA" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Mot de passe"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#AAAAAA" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.disabledButton]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.loginButtonText}>Se connecter</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.registerLink} onPress={() => navigation.navigate("SignUp")}>
            <Text style={styles.registerLinkText}>Pas encore de compte ? S'inscrire</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#c1dbb0",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoIconContainer: {
    width: 100,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 10,
  },
  appName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 5,
  },
  appSlogan: {
    fontSize: 16,
    color: "#FFFFFF",
    textAlign: "center",
  },
  formContainer: {
    width: "100%",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#96c06e",
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    color: "#FFFFFF",
    fontSize: 16,
  },
  passwordToggle: {
    padding: 10,
  },
  loginButton: {
    backgroundColor: "#6ca81f",
    borderRadius: 30,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  disabledButton: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  registerLink: {
    marginTop: 20,
    alignItems: "center",
  },
  registerLinkText: {
    color: "#6ca81f",
    fontSize: 16,
  },
  errorText: {
    color: "#FF5252",
    textAlign: "center",
    marginBottom: 20,
  },
  offlineWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 193, 7, 0.1)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  offlineWarningText: {
    color: "#FFC107",
    marginLeft: 8,
    fontSize: 14,
  },
})

export default LoginScreen
