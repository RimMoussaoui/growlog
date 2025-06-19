"use client"

import { useState, useEffect } from "react"
import { NavigationContainer } from "@react-navigation/native"
import { createStackNavigator } from "@react-navigation/stack"
import { StatusBar, ActivityIndicator, View, StyleSheet, Alert, LogBox } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"
import AsyncStorage from "@react-native-async-storage/async-storage"

// Services
import * as AuthService from "./services/auth"
import { isOnline } from "./services/network"
import { demoProfile } from "./services/demoData"

// Providers
import { MapTileProvider } from "./components/MapTileProvider"

// Écrans
import LoginScreen from "./screens/LoginScreen"
import SignUpScreen from "./screens/SignUpScreen"
import HomeScreen from "./screens/HomeScreen"
import AddProjectScreen from "./screens/AddProjectScreen"
import ProjectDetailScreen from "./screens/ProjectDetailsScreen"
import ProjectMapScreen from "./screens/ProjectMapScreen"
import AddTreeScreen from "./screens/AddTreeScreen"
import TreeDetailsScreen from "./screens/TreeDetailsScreen"
import TreeHistoryScreen from "./screens/TreeHistoryScreen"
import MapCacheScreen from "./screens/MapCacheScreen"
import SyncScreen from "./screens/SyncScreen"
import UserProfileScreen from "./screens/UserProfileScreen"
import AddHistoryScreen from "./screens/AddHistoryScreen"
// Supprimer l'import :
// import InvitationsScreen from "./screens/InvitationsScreen"

// Ignorer les avertissements non critiques
LogBox.ignoreLogs([
  "getDefaultEventTypes",
  "Non-serializable values were found in the navigation state",
  "VirtualizedLists should never be nested",
])

const Stack = createStackNavigator()

// Clé pour le stockage du profil
const PROFILE_STORAGE_KEY = "user_profile_direct"

const App = () => {
  const [loading, setLoading] = useState(true)
  const [userToken, setUserToken] = useState(null)
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const [user, setUser] = useState(null)

  // Fonction pour initialiser les données de l'application
  const initializeAppData = async () => {
    try {
      console.log("Initialisation des données de l'application...")

      // Vérifier si un profil existe déjà
      const storedProfile = await AsyncStorage.getItem(PROFILE_STORAGE_KEY)

      if (!storedProfile) {
        console.log("Aucun profil trouvé, initialisation du profil de démonstration...")
        // Sauvegarder le profil de démonstration
        await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(demoProfile))
        console.log("Profil de démonstration initialisé:", demoProfile)
      } else {
        console.log("Profil existant trouvé:", JSON.parse(storedProfile))
      }

      // Vérifier l'état de la connexion
      const online = await isOnline()
      setIsOfflineMode(!online)
    } catch (error) {
      console.error("Erreur lors de l'initialisation des données:", error)
    }
  }

  // Fonction pour mettre à jour l'état d'authentification
  const updateAuthState = async () => {
    try {
      // Initialiser les données de l'application
      await initializeAppData()

      const isAuth = await AuthService.isAuthenticated()
      if (isAuth) {
        const currentUser = await AuthService.getCurrentUser()
        setUser(currentUser)
        setUserToken("authenticated")
      } else {
        setUser(null)
        setUserToken(null)
      }
    } catch (error) {
      console.error("Erreur lors de la vérification de l'authentification:", error)
      setUserToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  // Fonction pour gérer les erreurs d'authentification
  const handleAuthError = async () => {
    try {
      await AuthService.resetAuth()
      updateAuthState()
      Alert.alert("Session expirée", "Votre session a expiré. Veuillez vous reconnecter.", [{ text: "OK" }])
    } catch (error) {
      console.error("Erreur lors de la gestion de l'erreur d'authentification:", error)
    }
  }

  // Fonction pour gérer la connexion réussie
  const handleLoginSuccess = async () => {
    console.log("Connexion réussie, mise à jour de l'état d'authentification...")
    await updateAuthState()
  }

  // Fonction pour gérer la déconnexion
  const handleLogout = async () => {
    try {
      setLoading(true)
      await AuthService.logoutUser()
      await AsyncStorage.removeItem(PROFILE_STORAGE_KEY)
      setUser(null)
      setUserToken(null)
      console.log("Déconnexion réussie")
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error)
      Alert.alert("Erreur", "Impossible de se déconnecter")
    } finally {
      setLoading(false)
    }
  }

  // Vérifier périodiquement l'état de la connexion
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

    // Vérifier l'état de la connexion au démarrage
    checkNetworkStatus()

    // Vérifier périodiquement l'état de la connexion
    const networkInterval = setInterval(checkNetworkStatus, 30000) // Toutes les 30 secondes

    return () => clearInterval(networkInterval)
  }, [])

  // Initialisation de l'application
  useEffect(() => {
    updateAuthState()

    // Configurer l'EventEmitter global pour la déconnexion
    if (!global.EventEmitter) {
      global.EventEmitter = {
        _events: {},
        emit: function (event, ...args) {
          if (this._events[event]) {
            this._events[event].forEach((callback) => callback(...args))
          }
        },
        on: function (event, callback) {
          if (!this._events[event]) {
            this._events[event] = []
          }
          this._events[event].push(callback)
          return () => {
            this._events[event] = this._events[event].filter((cb) => cb !== callback)
          }
        },
      }
    }

    // Écouter l'événement de déconnexion
    const unsubscribeLogout = global.EventEmitter.on("logout", handleLogout)

    // Ajouter un écouteur pour les erreurs d'authentification
    const authErrorListener = (event) => {
      if (event.data && event.data.type === "AUTH_ERROR") {
        handleAuthError()
      }
    }

    global.addEventListener && global.addEventListener("message", authErrorListener)

    // Vérifier périodiquement s'il y a eu une demande de vérification d'authentification
    const authCheckInterval = setInterval(async () => {
      try {
        const forceCheck = await AsyncStorage.getItem("forceAuthCheck")
        if (forceCheck) {
          await AsyncStorage.removeItem("forceAuthCheck")
          updateAuthState()
        }
      } catch (e) {
        console.error("Erreur lors de la vérification d'authentification:", e)
      }
    }, 1000)

    return () => {
      global.removeEventListener && global.removeEventListener("message", authErrorListener)
      unsubscribeLogout && unsubscribeLogout()
      clearInterval(authCheckInterval)
    }
  }, [])

  // Afficher l'écran de chargement
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00C853" />
      </View>
    )
  }

  return (
    <SafeAreaProvider>
      <MapTileProvider>
        <NavigationContainer>
          <StatusBar barStyle="light-content" backgroundColor="#222222" />
          <Stack.Navigator
            initialRouteName={userToken ? "Home" : "Login"}
            screenOptions={{
              headerShown: false,
              cardStyle: { backgroundColor: "#222222" },
              gestureEnabled: true,
              gestureDirection: "horizontal",
            }}
            onStateChange={(state) => {
              console.log("Navigation state changed:", state?.routes?.[state.index]?.name)
            }}
          >
            {!userToken ? (
              // Écrans pour les utilisateurs non authentifiés
              <>
                <Stack.Screen name="Login">
                  {(props) => <LoginScreen {...props} onLoginSuccess={handleLoginSuccess} />}
                </Stack.Screen>
                <Stack.Screen name="SignUp" options={{ headerShown: false }}>
                {(props) => <SignUpScreen {...props} onSignUpSuccess={updateAuthState} />}
                </Stack.Screen>
              </>
            ) : (
              // Écrans pour les utilisateurs authentifiés
              <>
                <Stack.Screen
                  name="Home"
                  component={HomeScreen}
                  options={{
                    title: "Accueil",
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="AddProject"
                  component={AddProjectScreen}
                  options={{
                    title: "Nouveau Projet",
                    headerShown: false,
                    presentation: "modal",
                  }}
                />
                <Stack.Screen
                  name="ProjectDetail"
                  component={ProjectDetailScreen}
                  options={{
                    title: "Détails du projet",
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="ProjectMap"
                  component={ProjectMapScreen}
                  options={{
                    title: "Carte du projet",
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="AddTree"
                  component={AddTreeScreen}
                  options={{
                    title: "Ajouter un arbre",
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="TreeDetails"
                  component={TreeDetailsScreen}
                  options={{
                    title: "Détails de l'arbre",
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="AddHistory"
                  component={AddHistoryScreen}
                  options={{
                    title: "Ajouter un historique",
                    headerShown: false,
                    presentation: "modal",
                  }}
                />
                 <Stack.Screen
                    name="TreeHistory"
                    component={TreeHistoryScreen}
                    options={{
                       title: "Historique de l'arbre",
                       headerShown: false,
                  }}
               />
                
                <Stack.Screen
                  name="MapCache"
                  component={MapCacheScreen}
                  options={{
                    title: "Gestion du cache des cartes",
                    headerShown: false,
                    presentation: "modal",
                  }}
                />
                <Stack.Screen
                  name="Sync"
                  component={SyncScreen}
                  options={{
                    title: "Synchronisation",
                    headerShown: false,
                    presentation: "modal",
                  }}
                />
                <Stack.Screen
                  name="UserProfile"
                  component={UserProfileScreen}
                  options={{
                    title: "Profil Utilisateur",
                    headerShown: false,
                    presentation: "modal",
                  }}
                />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </MapTileProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#222222",
  },
})

export default App
