import AsyncStorage from "@react-native-async-storage/async-storage"
import api from "./api"
import { isOnline, testInternetConnection } from "./network"
import { demoProfile } from "./demoData"

// Clés de stockage
const AUTH_TOKEN_KEY = "authToken"
const USER_PROFILE_KEY = "user_profile_direct"
const LAST_LOGIN_ATTEMPT_KEY = "last_login_attempt"

/**
 * Service d'authentification
 */

/**
 * Vérifie si l'utilisateur est authentifié
 * @returns {Promise<boolean>} - Vrai si l'utilisateur est authentifié
 */
export const isAuthenticated = async () => {
  try {
    console.log("[Auth] Vérification de l'authentification...")

    // Vérifier si un token existe
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY)

    // Vérifier si un profil utilisateur existe
    const userProfile = await AsyncStorage.getItem(USER_PROFILE_KEY)

    // Si nous avons un token et un profil, l'utilisateur est authentifié
    const isAuth = !!token && !!userProfile

    console.log(`[Auth] Utilisateur authentifié: ${isAuth}`)
    return isAuth
  } catch (error) {
    console.error("[Auth] Erreur lors de la vérification de l'authentification:", error)
    return false
  }
}

/**
 * Connecte un utilisateur
 * @param {string} email - Email de l'utilisateur
 * @param {string} password - Mot de passe de l'utilisateur
 * @returns {Promise<Object>} - Profil de l'utilisateur
 */
export const loginUser = async (email, password) => {
  try {
    console.log(`[Auth] Tentative de connexion pour ${email}...`)

    // Enregistrer la tentative de connexion
    await AsyncStorage.setItem(
      LAST_LOGIN_ATTEMPT_KEY,
      JSON.stringify({
        email,
        timestamp: Date.now(),
      }),
    )

    // Vérifier si nous sommes en ligne
    const online = await isOnline()

    if (!online) {
      console.log("[Auth] Mode hors ligne, tentative de connexion locale")
      return await handleOfflineLogin(email, password)
    }

    try {
      // Essayer de se connecter au serveur
      const response = await api.post("/auth/login", { email, password })

      if (response._error) {
        throw new Error(response.message || "Échec de la connexion")
      }

      // Stocker le token d'authentification
      if (response.token) {
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.token)
      }

      // Stocker le profil utilisateur
      if (response.user) {
        await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(response.user))
      }

      console.log("[Auth] Connexion réussie")
      return response.user
    } catch (networkError) {
      console.error("[Auth] Erreur réseau lors de la connexion:", networkError)

      // Essayer une vérification plus approfondie de la connexion
      const reallyOnline = await testInternetConnection()

      if (reallyOnline) {
        // Réessayer la connexion une fois
        try {
          const response = await api.post("/auth/login", { email, password })

          if (response._error) {
            throw new Error(response.message || "Échec de la connexion")
          }

          // Stocker le token d'authentification
          if (response.token) {
            await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.token)
          }

          // Stocker le profil utilisateur
          if (response.user) {
            await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(response.user))
          }

          console.log("[Auth] Connexion réussie après nouvelle tentative")
          return response.user
        } catch (retryError) {
          console.error("[Auth] Échec de la seconde tentative:", retryError)
          return await handleOfflineLogin(email, password)
        }
      } else {
        // Si nous ne sommes pas vraiment en ligne, essayer la connexion hors ligne
        return await handleOfflineLogin(email, password)
      }
    }
  } catch (error) {
    console.error("[Auth] Erreur lors de la connexion:", error)
    throw new Error(error.message || "Échec de la connexion")
  }
}

/**
 * Gère la connexion en mode hors ligne
 * @param {string} email - Email de l'utilisateur
 * @param {string} password - Mot de passe de l'utilisateur
 * @returns {Promise<Object>} - Profil de l'utilisateur
 */
async function handleOfflineLogin(email, password) {
  console.log("[Auth] Tentative de connexion hors ligne")

  // Pour le mode démo, accepter n'importe quel email/mot de passe
  // Dans une application réelle, vous devriez vérifier les identifiants stockés localement

  // Vérifier si un profil existe déjà
  const existingProfile = await AsyncStorage.getItem(USER_PROFILE_KEY)

  if (existingProfile) {
    // Utiliser le profil existant
    const profile = JSON.parse(existingProfile)

    // Vérifier si l'email correspond
    if (profile.email === email) {
      // Dans une application réelle, vous devriez vérifier le mot de passe haché
      // Pour le mode démo, nous acceptons n'importe quel mot de passe

      // Générer un token local
      const localToken = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, localToken)

      console.log("[Auth] Connexion hors ligne réussie avec profil existant")
      return profile
    }
  }

  // Si aucun profil correspondant n'existe, utiliser le profil de démo
  // Modifier le profil de démo pour utiliser l'email fourni
  const modifiedDemoProfile = {
    ...demoProfile,
    email: email,
    name: email.split("@")[0], // Utiliser la partie avant @ comme nom
  }

  // Stocker le profil modifié
  await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(modifiedDemoProfile))

  // Générer un token local
  const localToken = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, localToken)

  console.log("[Auth] Connexion hors ligne réussie avec profil de démo")
  return modifiedDemoProfile
}

/**
 * Inscrit un nouvel utilisateur
 * @param {Object} userData - Données de l'utilisateur
 * @returns {Promise<Object>} - Profil de l'utilisateur
 */
export const registerUser = async (userData) => {
  try {
    console.log("[Auth] Tentative d'inscription...")

    // Vérifier si nous sommes en ligne
    const online = await isOnline()

    if (!online) {
      console.log("[Auth] Mode hors ligne, inscription locale")
      return await handleOfflineRegistration(userData)
    }

    try {
      // Essayer de s'inscrire sur le serveur
      const response = await api.post("/auth/register", userData)

      if (response._error) {
        throw new Error(response.message || "Échec de l'inscription")
      }

      // Stocker le token d'authentification
      if (response.token) {
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.token)
      }

      // Stocker le profil utilisateur
      if (response.user) {
        await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(response.user))
      }

      console.log("[Auth] Inscription réussie")
      return response.user
    } catch (networkError) {
      console.error("[Auth] Erreur réseau lors de l'inscription:", networkError)

      // Essayer une vérification plus approfondie de la connexion
      const reallyOnline = await testInternetConnection()

      if (reallyOnline) {
        // Réessayer l'inscription une fois
        try {
          const response = await api.post("/auth/register", userData)

          if (response._error) {
            throw new Error(response.message || "Échec de l'inscription")
          }

          // Stocker le token d'authentification
          if (response.token) {
            await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.token)
          }

          // Stocker le profil utilisateur
          if (response.user) {
            await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(response.user))
          }

          console.log("[Auth] Inscription réussie après nouvelle tentative")
          return response.user
        } catch (retryError) {
          console.error("[Auth] Échec de la seconde tentative d'inscription:", retryError)
          return await handleOfflineRegistration(userData)
        }
      } else {
        // Si nous ne sommes pas vraiment en ligne, faire une inscription hors ligne
        return await handleOfflineRegistration(userData)
      }
    }
  } catch (error) {
    console.error("[Auth] Erreur lors de l'inscription:", error)
    throw new Error(error.message || "Échec de l'inscription")
  }
}

/**
 * Gère l'inscription en mode hors ligne
 * @param {Object} userData - Données de l'utilisateur
 * @returns {Promise<Object>} - Profil de l'utilisateur
 */
async function handleOfflineRegistration(userData) {
  console.log("[Auth] Inscription hors ligne")

  // Créer un profil utilisateur local
  const localProfile = {
    ...userData,
    _id: `local_${Date.now()}`,
    createdAt: new Date().toISOString(),
    _local: true,
  }

  // Stocker le profil
  await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(localProfile))

  // Générer un token local
  const localToken = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, localToken)

  console.log("[Auth] Inscription hors ligne réussie")
  return localProfile
}

/**
 * Déconnecte l'utilisateur
 * @returns {Promise<void>}
 */
export const logoutUser = async () => {
  try {
    console.log("[Auth] Déconnexion...")

    // Supprimer le token d'authentification
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY)

    // Ne pas supprimer le profil utilisateur pour permettre la reconnexion hors ligne
    // Si vous voulez une déconnexion complète, décommentez la ligne suivante
    // await AsyncStorage.removeItem(USER_PROFILE_KEY)

    console.log("[Auth] Déconnexion réussie")
  } catch (error) {
    console.error("[Auth] Erreur lors de la déconnexion:", error)
    throw error
  }
}

/**
 * Récupère l'utilisateur actuel
 * @returns {Promise<Object>} - Profil de l'utilisateur
 */
export const getCurrentUser = async () => {
  try {
    console.log("[Auth] Récupération de l'utilisateur actuel...")

    // Récupérer le profil utilisateur depuis le stockage local
    const userProfileString = await AsyncStorage.getItem(USER_PROFILE_KEY)

    if (!userProfileString) {
      console.log("[Auth] Aucun profil utilisateur trouvé")
      return null
    }

    const userProfile = JSON.parse(userProfileString)
    console.log("[Auth] Profil utilisateur récupéré")
    return userProfile
  } catch (error) {
    console.error("[Auth] Erreur lors de la récupération de l'utilisateur actuel:", error)
    return null
  }
}

/**
 * Met à jour le profil de l'utilisateur
 * @param {Object} userData - Données de l'utilisateur à mettre à jour
 * @returns {Promise<Object>} - Profil mis à jour
 */
export const updateUserProfile = async (userData) => {
  try {
    console.log("[Auth] Mise à jour du profil utilisateur...")

    // Récupérer le profil existant
    const existingProfileString = await AsyncStorage.getItem(USER_PROFILE_KEY)

    if (!existingProfileString) {
      throw new Error("Aucun profil utilisateur trouvé")
    }

    const existingProfile = JSON.parse(existingProfileString)

    // Fusionner les données existantes avec les nouvelles données
    const updatedProfile = {
      ...existingProfile,
      ...userData,
      updatedAt: new Date().toISOString(),
    }

    // Vérifier si nous sommes en ligne
    const online = await isOnline()

    if (online) {
      try {
        // Essayer de mettre à jour le profil sur le serveur
        const response = await api.put("/users/profile", userData)

        if (!response._error) {
          // Si la mise à jour sur le serveur a réussi, utiliser la réponse du serveur
          const serverProfile = {
            ...updatedProfile,
            ...response,
          }

          // Stocker le profil mis à jour
          await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(serverProfile))

          console.log("[Auth] Profil utilisateur mis à jour sur le serveur")
          return serverProfile
        }
      } catch (error) {
        console.error("[Auth] Erreur lors de la mise à jour du profil sur le serveur:", error)
        // Continuer avec la mise à jour locale en cas d'erreur
      }
    }

    // Mise à jour locale
    await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(updatedProfile))

    console.log("[Auth] Profil utilisateur mis à jour localement")
    return updatedProfile
  } catch (error) {
    console.error("[Auth] Erreur lors de la mise à jour du profil utilisateur:", error)
    throw error
  }
}

/**
 * Réinitialise l'état d'authentification
 * @returns {Promise<void>}
 */
export const resetAuth = async () => {
  try {
    console.log("[Auth] Réinitialisation de l'état d'authentification...")

    // Supprimer le token d'authentification
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY)

    console.log("[Auth] État d'authentification réinitialisé")
  } catch (error) {
    console.error("[Auth] Erreur lors de la réinitialisation de l'état d'authentification:", error)
    throw error
  }
}

/**
 * Force la connexion en mode démo
 * @returns {Promise<Object>} - Profil de l'utilisateur
 */
export const forceDemoLogin = async () => {
  try {
    console.log("[Auth] Forçage de la connexion en mode démo...")

    // Stocker le profil de démo
    await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(demoProfile))

    // Générer un token local
    const localToken = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, localToken)

    console.log("[Auth] Connexion en mode démo forcée")
    return demoProfile
  } catch (error) {
    console.error("[Auth] Erreur lors du forçage de la connexion en mode démo:", error)
    throw error
  }
}

/**
 * Récupère la dernière tentative de connexion
 * @returns {Promise<Object>} - Dernière tentative de connexion
 */
export const getLastLoginAttempt = async () => {
  try {
    const lastAttemptString = await AsyncStorage.getItem(LAST_LOGIN_ATTEMPT_KEY)
    return lastAttemptString ? JSON.parse(lastAttemptString) : null
  } catch (error) {
    console.error("[Auth] Erreur lors de la récupération de la dernière tentative de connexion:", error)
    return null
  }
}
