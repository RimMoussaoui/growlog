"use client"

// screens/SignUpScreen.js
import { useState } from "react"
import { ActivityIndicator, Alert, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native"
import * as AuthService from "../services/auth"

const SignUpScreen = ({ navigation, onSignUpSuccess }) => {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSignUp = async () => {
    try {
      // Reset error
      setError("")

      // Validate inputs
      if (!name || !password) {
        setError("Nom et mot de passe requis")
        return
      }

      if (!email) {
        setError("Email requis")
        return
      }

      if (password !== confirmPassword) {
        setError("Les mots de passe ne correspondent pas")
        return
      }

      // Vérifier si l'email est au bon format
      if (!email.includes("@")) {
        setError("Format d'email invalide")
        return
      }

      setLoading(true)

      // Créer un objet userData avec les informations d'inscription
      const userData = {
        name,
        email,
        password,
      }

      // Appeler registerUser avec l'objet userData
      await AuthService.registerUser(userData)

      // Informer le composant parent que l'inscription a réussi
      if (onSignUpSuccess) {
        Alert.alert("Inscription réussie", "Votre compte a été créé avec succès!", [
          { text: "OK", onPress: () => onSignUpSuccess() },
        ])
      } else {
        // Fallback pour le développement
        Alert.alert("Inscription réussie", "Votre compte a été créé avec succès!", [{ text: "OK" }])
      }
    } catch (error) {
      console.error("Erreur d'inscription:", error)
      setError(error.message || "Erreur lors de l'inscription")
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#222" />

      <Text style={styles.title}>Créer un compte</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Nom"
        placeholderTextColor="#FFFFFF"
        value={name}
        onChangeText={setName}
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#FFFFFF"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        placeholderTextColor="#FFFFFF"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TextInput
        style={styles.input}
        placeholder="Confirmer le mot de passe"
        placeholderTextColor="#FFFFFF"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>S'inscrire</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate("Login")}>
        <Text style={styles.linkText}>Vous avez déjà un compte? Connectez-vous</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#c1dbb0",
    padding: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 30,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#96c06e",
    borderRadius: 8,
    padding: 15,
    marginBottom: 16,
    color: "#FFFFFF",
  },
  button: {
    backgroundColor: "#6ca81f",
    borderRadius: 30,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  linkButton: {
    marginTop: 20,
    alignItems: "center",
  },
  linkText: {
    color: "#6ca81f",
    fontSize: 14,
  },
  errorText: {
    color: "#FF5252",
    marginBottom: 20,
    textAlign: "center",
  },
})

export default SignUpScreen
