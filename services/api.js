import AsyncStorage from "@react-native-async-storage/async-storage"
import { isOnline, addToOfflineQueue, getOfflineQueue, removeFromOfflineQueue } from "./network"

// URL de base de l'API
const API_BASE_URL = "https://back-api-dlu0.onrender.com/api"

// Clé pour le stockage du token d'authentification
const AUTH_TOKEN_KEY = "authToken"

// Clé pour le cache des données
const CACHE_PREFIX = "api_cache_"

// Clé pour le stockage local de l'historique
const HISTORY_PREFIX = "tree_history_"

/**
 * Effectue une requête HTTP
 * @param {string} method - Méthode HTTP (GET, POST, PUT, DELETE)
 * @param {string} url - URL de l'API
 * @param {Object} data - Données à envoyer (pour POST et PUT)
 * @param {Object} options - Options supplémentaires pour la requête
 * @returns {Promise<Object>} - Réponse de l'API
 */
async function request(method, url, data = null, options = {}) {
  const online = await isOnline()
  const headers = {
    "Content-Type": "application/json",
    // Ajoutez ici d'autres en-têtes communs, comme l'autorisation
  }

  // Récupérer le token d'authentification
  const authToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY)
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`
  }

  const requestOptions = {
    method,
    headers,
    ...(data ? { body: JSON.stringify(data) } : {}),
    ...options,
  }

  try {
    console.log(`[API] ${method} ${url}`, data || "")

    if (!online) {
      console.warn(`[API] 📴 Mode hors ligne, mise en file d'attente de la requête: ${method} ${url}`)

      const entityId = options.entityId || `${method}_${url}_${Date.now()}`
      await addToOfflineQueue({ method, url, data, options, entityId })

      return { _queued: true, _pendingSync: true, message: "Requête mise en file d'attente (hors ligne)" }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // Timeout de 15 secondes

    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...requestOptions,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const responseData = await response.json()

    if (!response.ok) {
      console.error(`[API] Erreur ${method} ${url}:`, response.status, responseData)
      return { _error: true, status: response.status, message: responseData.message || "Erreur API" }
    }

    console.log(`[API] ${method} ${url} - Réponse:`, responseData)
    return responseData
  } catch (error) {
    console.error(`[API] Erreur ${method} ${url}:`, error)

    if (error.name === "AbortError") {
      return { _error: true, message: "Timeout de la requête" }
    }

    if (!online) {
      console.warn(`[API] 📴 Mode hors ligne, l'erreur est due à la déconnexion: ${method} ${url}`)
      return { _error: true, message: "Hors ligne" }
    }

    return { _error: true, message: error.message || "Erreur lors de la requête" }
  }
}

/**
 * Met en cache les données de l'API
 * @param {string} endpoint - Point de terminaison de l'API
 * @param {Object} data - Données à mettre en cache
 */
async function cacheData(endpoint, data) {
  try {
    const cacheKey = endpoint.replace(/[^a-zA-Z0-9]/g, "_") // Nettoyer l'endpoint pour l'utiliser comme clé
    const cacheEntry = {
      data,
      timestamp: Date.now(),
    }
    await AsyncStorage.setItem(`${CACHE_PREFIX}${cacheKey}`, JSON.stringify(cacheEntry))
    console.log(`[API] 💾 Données mises en cache pour ${endpoint}`)
  } catch (error) {
    console.error(`[API] Erreur lors de la mise en cache de ${endpoint}:`, error)
  }
}

/**
 * Récupère les données en cache
 * @param {string} endpoint - Point de terminaison de l'API
 * @returns {Object|null} - Données en cache ou null
 */
async function getCachedData(endpoint) {
  try {
    const cacheKey = endpoint.replace(/[^a-zA-Z0-9]/g, "_")
    const cachedEntry = await AsyncStorage.getItem(`${CACHE_PREFIX}${cacheKey}`)

    if (cachedEntry) {
      const parsed = JSON.parse(cachedEntry)
      const age = Date.now() - parsed.timestamp
      const maxAge = 5 * 60 * 1000 // 5 minutes

      if (age < maxAge) {
        return parsed.data
      } else {
        await AsyncStorage.removeItem(`${CACHE_PREFIX}${cacheKey}`)
        console.log(`[API] 🗑️ Cache expiré pour ${endpoint}`)
      }
    }

    return null
  } catch (error) {
    console.error(`[API] Erreur lors de la récupération du cache pour ${endpoint}:`, error)
    return null
  }
}

/**
 * Ajoute une entrée à l'historique local
 * @param {string} treeId - ID de l'arbre
 * @param {Object} entry - Entrée d'historique
 */
async function addLocalHistoryEntry(treeId, entry) {
  try {
    const historyKey = `${HISTORY_PREFIX}${treeId}`
    const existingHistory = await AsyncStorage.getItem(historyKey)
    const history = existingHistory ? JSON.parse(existingHistory) : []

    // Ajouter l'entrée à l'historique
    history.push(entry)

    // Sauvegarder l'historique mis à jour
    await AsyncStorage.setItem(historyKey, JSON.stringify(history))
    console.log(`[API] 💾 Entrée d'historique ajoutée localement pour l'arbre ${treeId}`)
  } catch (error) {
    console.error(`[API] Erreur lors de l'ajout de l'entrée d'historique locale pour l'arbre ${treeId}:`, error)
  }
}

/**
 * Récupère l'historique local
 * @param {string} treeId - ID de l'arbre
 * @param {string} year - Année de l'historique (optionnel)
 * @returns {Array} - Historique local
 */
async function getLocalHistory(treeId, year = null) {
  try {
    const historyKey = `${HISTORY_PREFIX}${treeId}`
    const existingHistory = await AsyncStorage.getItem(historyKey)

    if (existingHistory) {
      let history = JSON.parse(existingHistory)

      // Filtrer par année si spécifiée
      if (year) {
        history = history.filter((entry) => new Date(entry.date).getFullYear() === Number.parseInt(year))
      }

      return history
    }

    return null
  } catch (error) {
    console.error(`[API] Erreur lors de la récupération de l'historique local pour l'arbre ${treeId}:`, error)
    return null
  }
}

/**
 * Sauvegarde l'historique local
 * @param {string} treeId - ID de l'arbre
 * @param {Array} history - Historique à sauvegarder
 */
async function saveLocalHistory(treeId, history) {
  try {
    const historyKey = `${HISTORY_PREFIX}${treeId}`
    await AsyncStorage.setItem(historyKey, JSON.stringify(history))
    console.log(`[API] 💾 Historique local sauvegardé pour l'arbre ${treeId}`)
  } catch (error) {
    console.error(`[API] Erreur lors de la sauvegarde de l'historique local pour l'arbre ${treeId}:`, error)
  }
}

/**
 * Supprime une entrée de l'historique local
 * @param {string} treeId - ID de l'arbre
 * @param {string} year - Année de l'entrée
 * @param {string} timestamp - Timestamp de l'entrée
 */
async function removeLocalHistoryEntry(treeId, year, timestamp) {
  try {
    const historyKey = `${HISTORY_PREFIX}${treeId}`
    const existingHistory = await AsyncStorage.getItem(historyKey)

    if (existingHistory) {
      let history = JSON.parse(existingHistory)

      // Filtrer pour exclure l'entrée à supprimer
      history = history.filter((entry) => {
        const entryYear = new Date(entry.date).getFullYear().toString()
        const entryTimestamp = entry.timestamp.toString()
        return !(entryYear === year && entryTimestamp === timestamp)
      })

      // Sauvegarder l'historique mis à jour
      await AsyncStorage.setItem(historyKey, JSON.stringify(history))
      console.log(`[API] 🗑️ Entrée d'historique supprimée localement pour l'arbre ${treeId}`)
    }
  } catch (error) {
    console.error(`[API] Erreur lors de la suppression de l'entrée d'historique locale pour l'arbre ${treeId}:`, error)
  }
}

// Ajouter cette fonction de débogage pour voir les réponses API
const logApiResponse = (endpoint, data) => {
  console.log(`[API] Réponse de ${endpoint}:`, JSON.stringify(data, null, 2))
  return data
}

/**
 * Force la vérification de la connectivité réseau
 * @returns {Promise<boolean>} - État de la connectivité
 */
async function forceNetworkCheck() {
  try {
    console.log("[API] 🔄 Vérification forcée de la connectivité réseau")

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)

    const response = await fetch(`${API_BASE_URL}/health`, {
      method: "HEAD",
      signal: controller.signal,
      cache: "no-cache",
    })

    clearTimeout(timeoutId)

    const isConnected = response.ok
    console.log(`[API] 📡 État de la connectivité: ${isConnected ? "✅ En ligne" : "❌ Hors ligne"}`)

    return isConnected
  } catch (error) {
    console.log(`[API] 📡 État de la connectivité: ❌ Hors ligne (${error.message})`)
    return false
  }
}

/**
 * Fonction de débogage pour inspecter l'historique local
 * @param {string} treeId - ID de l'arbre
 * @returns {Promise<Object>} - Informations de débogage
 */
async function debugHistory(treeId) {
  try {
    console.log(`[API] 🔍 Débogage de l'historique pour l'arbre ${treeId}`)

    const historyKey = `${HISTORY_PREFIX}${treeId}`
    const rawData = await AsyncStorage.getItem(historyKey)

    const debugInfo = {
      treeId,
      historyKey,
      hasLocalData: !!rawData,
      rawDataLength: rawData ? rawData.length : 0,
      timestamp: new Date().toISOString(),
    }

    if (rawData) {
      try {
        const parsedData = JSON.parse(rawData)
        debugInfo.parsedData = parsedData
        debugInfo.entriesCount = Array.isArray(parsedData) ? parsedData.length : 0
        debugInfo.dataType = Array.isArray(parsedData) ? "array" : typeof parsedData
      } catch (parseError) {
        debugInfo.parseError = parseError.message
        debugInfo.rawDataPreview = rawData.substring(0, 200)
      }
    }

    console.log(`[API] 📊 Informations de débogage pour l'arbre ${treeId}:`, debugInfo)
    return debugInfo
  } catch (error) {
    console.error(`[API] Erreur lors du débogage de l'historique pour l'arbre ${treeId}:`, error)
    return { error: error.message, treeId }
  }
}

/**
 * Service API pour effectuer des requêtes HTTP
 */
const api = {
  /**
   * Effectue une requête GET
   * @param {string} endpoint - Point de terminaison de l'API
   * @param {Object} options - Options supplémentaires pour la requête
   * @returns {Promise<Object>} - Réponse de l'API
   */
  get: async (endpoint, options = {}) => {
    try {
      const result = await request("GET", endpoint, null, options)

      // Mettre en cache les données si la requête a réussi
      if (result && !result._error && !result._queued) {
        await cacheData(endpoint, result)
      }

      return result
    } catch (error) {
      console.error(`[API] Erreur GET ${endpoint}:`, error)

      // Essayer de récupérer depuis le cache en cas d'erreur
      const cachedData = await getCachedData(endpoint)
      if (cachedData) {
        console.log(`[API] Utilisation des données en cache pour ${endpoint}`)
        return { ...cachedData, _fromCache: true }
      }

      throw error
    }
  },

  /**
   * Effectue une requête POST
   * @param {string} endpoint - Point de terminaison de l'API
   * @param {Object} data - Données à envoyer
   * @param {Object} options - Options supplémentaires pour la requête
   * @returns {Promise<Object>} - Réponse de l'API
   */
  post: async (endpoint, data, options = {}) => {
    return await request("POST", endpoint, data, options)
  },

  /**
   * Effectue une requête PUT
   * @param {string} endpoint - Point de terminaison de l'API
   * @param {Object} data - Données à envoyer
   * @param {Object} options - Options supplémentaires pour la requête
   * @returns {Promise<Object>} - Réponse de l'API
   */
  put: async (endpoint, data, options = {}) => {
    return await request("PUT", endpoint, data, options)
  },

  /**
   * Effectue une requête DELETE
   * @param {string} endpoint - Point de terminaison de l'API
   * @param {Object} options - Options supplémentaires pour la requête
   * @returns {Promise<Object>} - Réponse de l'API
   */
  delete: async (endpoint, options = {}) => {
    return await request("DELETE", endpoint, null, options)
  },

  /**
   * Récupère l'état de la synchronisation
   * @returns {Promise<Object>} - État de la synchronisation
   */
  getSyncStatus: async () => {
    try {
      const queue = await getOfflineQueue()
      return {
        pendingRequests: queue ? queue.length : 0,
        lastSync: await AsyncStorage.getItem("lastSyncTimestamp"),
      }
    } catch (error) {
      console.error("[API] Erreur lors de la récupération de l'état de synchronisation:", error)
      return { pendingRequests: 0, lastSync: null }
    }
  },

  /**
   * Synchronise les requêtes en attente
   * @returns {Promise<Object>} - Résultat de la synchronisation
   */
  syncPendingRequests: async () => {
    try {
      const online = await isOnline()
      if (!online) {
        return { success: false, message: "Hors ligne" }
      }

      const queue = await getOfflineQueue()
      if (!queue || queue.length === 0) {
        return { success: true, processed: 0 }
      }

      let processed = 0
      let failed = 0

      for (const item of queue) {
        try {
          await request(item.method, item.url, item.data, item.options)
          await removeFromOfflineQueue(item.entityId)
          processed++
        } catch (error) {
          console.error("[API] Erreur lors de la synchronisation:", error)
          failed++
        }
      }

      await AsyncStorage.setItem("lastSyncTimestamp", new Date().toISOString())

      return {
        success: failed === 0,
        processed,
        failed,
        remaining: failed,
      }
    } catch (error) {
      console.error("[API] Erreur lors de la synchronisation:", error)
      return { success: false, message: error.message }
    }
  },

  /**
   * Teste la connectivité avec l'API
   * @returns {Promise<Object>} - Résultat du test
   */
  testConnection: async () => {
    try {
      console.log("[API] Test de connectivité...")

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`${API_BASE_URL}/health`, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
      })

      clearTimeout(timeoutId)

      const result = {
        success: response.ok,
        status: response.status,
        url: API_BASE_URL,
        timestamp: new Date().toISOString(),
      }

      console.log("[API] Résultat du test de connectivité:", result)
      return result
    } catch (error) {
      console.error("[API] Erreur lors du test de connectivité:", error)
      return {
        success: false,
        error: error.message,
        url: API_BASE_URL,
        timestamp: new Date().toISOString(),
      }
    }
  },

  // Fonction pour ajouter l'historique avec les données de récolte
  addTreeHistoryEntry: async (treeId, historyEntry) => {
    try {
      console.log(`[API] 📝 Ajout d'une entrée d'historique pour l'arbre ${treeId}`)
      console.log(`[API] 📊 Données:`, historyEntry)

      // Préparer les données pour l'API - inclure TOUS les champs directement
      const apiData = {
        date: historyEntry.date,
        height: historyEntry.height,
        diameter: historyEntry.diameter,
        health: historyEntry.health,
        notes: historyEntry.notes || "",
        oliveQuantity: historyEntry.oliveQuantity,
        oilQuantity: historyEntry.oilQuantity,
        images: historyEntry.images,
        observations: historyEntry.observations,
        recordedBy: historyEntry.recordedBy,
        timestamp: historyEntry.timestamp,
      }

      console.log(`[API] 📦 Données formatées pour l'API:`, apiData)

      // Générer un ID unique pour cette entrée
      const entryId = `history_${treeId}_${Date.now()}`

      // Envoyer à l'API
      const result = await request("POST", `/trees/${treeId}/history`, apiData, { entityId: entryId })

      console.log(`[API] 📋 Réponse complète de l'API:`, result)

      // Vérifier si la requête a vraiment réussi (pas mise en file d'attente)
      if (result && !result._error && !result._queued && !result._pendingSync) {
        // Vérifier si nous avons une réponse positive du serveur
        if (result.success === true || result.message?.includes("succès") || result.entry) {
          console.log(`[API] ✅ Entrée d'historique ajoutée avec succès sur le serveur`)

          // Ajouter l'entrée au stockage local pour la synchronisation
          await addLocalHistoryEntry(treeId, {
            ...historyEntry,
            timestamp: historyEntry.timestamp || Date.now(),
            id: entryId,
            isOffline: false, // Marquer comme en ligne
            synced: true, // Marquer comme synchronisé
          })

          return {
            success: true,
            message: "Entrée ajoutée avec succès",
            entry: {
              ...historyEntry,
              id: entryId,
              isOffline: false,
              synced: true,
            },
            online: true,
          }
        }
      }

      // Si la requête a été mise en file d'attente (mode hors ligne)
      if (result._queued || result._pendingSync) {
        console.log(`[API] 📴 Entrée mise en file d'attente pour synchronisation ultérieure`)

        await addLocalHistoryEntry(treeId, {
          ...historyEntry,
          timestamp: historyEntry.timestamp || Date.now(),
          id: entryId,
          isOffline: true,
          synced: false,
        })

        return {
          success: true,
          message: "Entrée ajoutée en mode hors ligne",
          entry: {
            ...historyEntry,
            id: entryId,
            isOffline: true,
            synced: false,
          },
          online: false,
        }
      }

      // En cas d'erreur API
      console.error(`[API] ❌ Erreur lors de l'ajout de l'entrée d'historique:`, result)

      // Essayer d'ajouter localement malgré l'erreur API
      await addLocalHistoryEntry(treeId, {
        ...historyEntry,
        timestamp: historyEntry.timestamp || Date.now(),
        id: entryId,
        isOffline: true,
        synced: false,
        error: result.message,
      })

      return {
        success: false,
        message: result.message || "Erreur lors de l'ajout de l'entrée d'historique",
        error: result,
        online: false,
      }
    } catch (error) {
      console.error(`[API] 💥 Erreur lors de l'ajout de l'entrée d'historique:`, error)

      // En cas d'erreur, essayer d'ajouter localement
      const entryId = `history_${treeId}_${Date.now()}`
      await addLocalHistoryEntry(treeId, {
        ...historyEntry,
        timestamp: historyEntry.timestamp || Date.now(),
        id: entryId,
        isOffline: true,
        synced: false,
        error: error.message,
      })

      return {
        success: false,
        message: "Erreur lors de l'ajout de l'entrée d'historique, mais sauvegardée localement",
        error: error.message,
        online: false,
      }
    }
  },

  // Fonction pour récupérer l'historique (MODIFIÉE)
  getTreeHistory: async (treeId, year = null, forceRefresh = false) => {
    try {
      console.log(
        `[API] 📚 Récupération de l'historique pour l'arbre ${treeId}${year ? ` (année ${year})` : ""}${forceRefresh ? " (rafraîchissement forcé)" : ""}`,
      )

      // Construire l'endpoint
      let endpoint = `/trees/${treeId}/history`
      if (year) {
        endpoint += `?year=${year}`
      }

      // Si forceRefresh est true, ignorer le cache
      if (forceRefresh) {
        console.log(`[API] 🔄 Rafraîchissement forcé, ignorer le cache`)
        const cacheKey = `${CACHE_PREFIX}${endpoint.replace(/[^a-zA-Z0-9]/g, "_")}`
        await AsyncStorage.removeItem(cacheKey)
      }

      // Vérifier la connectivité
      const isConnected = await forceNetworkCheck()
      console.log(`[API] 🌐 Connectivité réseau: ${isConnected ? "En ligne" : "Hors ligne"}`)

      // Essayer de récupérer depuis l'API si en ligne
      if (isConnected) {
        const result = await request("GET", endpoint, null, { entityId: `history_${treeId}_${year || "all"}` })

        console.log(`[API] 📋 Réponse brute de l'API:`, JSON.stringify(result, null, 2))

        // Si la requête a réussi
        if (result && !result._error && !result._queued) {
          console.log(`[API] ✅ Historique récupéré avec succès pour l'arbre ${treeId}`)

          // Analyser la structure de la réponse
          let historyData = result

          // Gérer différents formats de réponse API
          if (result.history) {
            historyData = result.history
            console.log(`[API] 📦 Historique trouvé dans result.history`)
          } else if (result.data) {
            historyData = result.data
            console.log(`[API] 📦 Historique trouvé dans result.data`)
          } else if (Array.isArray(result)) {
            historyData = result
            console.log(`[API] 📦 Historique est un tableau direct`)
          }

          console.log(`[API] 📊 Structure de l'historique:`, {
            type: typeof historyData,
            isArray: Array.isArray(historyData),
            length: Array.isArray(historyData) ? historyData.length : "N/A",
            keys: typeof historyData === "object" ? Object.keys(historyData) : "N/A",
          })

          // Mettre à jour le cache local avec les bonnes données
          if (Array.isArray(historyData)) {
            await saveLocalHistory(treeId, historyData)
            return historyData
          } else if (historyData && typeof historyData === "object") {
            await saveLocalHistory(treeId, historyData)
            return historyData
          }
        }
      }

      // En cas d'erreur ou mode hors ligne, utiliser les données locales
      console.log(`[API] 🔍 Recherche de l'historique local pour l'arbre ${treeId}`)

      // Déboguer l'historique local
      const debugInfo = await debugHistory(treeId)
      console.log(`[API] 🔧 Informations de débogage:`, debugInfo)

      const localHistory = await getLocalHistory(treeId, year)

      if (
        localHistory &&
        (Array.isArray(localHistory) ? localHistory.length > 0 : Object.keys(localHistory).length > 0)
      ) {
        console.log(`[API] 💾 Historique local trouvé pour l'arbre ${treeId}`)
        console.log(`[API] 📊 Contenu de l'historique local:`, localHistory)

        return { ...localHistory, _fromLocal: true }
      }

      // Aucune donnée disponible
      console.log(`[API] ❌ Aucun historique disponible pour l'arbre ${treeId}`)
      return {}
    } catch (error) {
      console.error(`[API] 💥 Erreur lors de la récupération de l'historique pour l'arbre ${treeId}:`, error)

      // Essayer de récupérer depuis le stockage local en cas d'erreur
      const localHistory = await getLocalHistory(treeId, year)
      if (localHistory) {
        return { ...localHistory, _fromLocal: true, _error: false }
      }

      return { _error: true, message: error.message || "Impossible de récupérer l'historique" }
    }
  },

  /**
   * Supprime une entrée de l'historique d'un arbre
   * @param {string} treeId - ID de l'arbre
   * @param {string} year - Année de l'entrée
   * @param {string} timestamp - Timestamp de l'entrée
   * @returns {Promise<Object>} - Résultat de l'opération
   */
  deleteTreeHistoryEntry: async (treeId, year, timestamp) => {
    try {
      console.log(`[API] 🗑️ Suppression de l'entrée d'historique ${timestamp} pour l'arbre ${treeId} (année ${year})`)

      // Envoyer à l'API
      const result = await request("DELETE", `/trees/${treeId}/history/${year}/${timestamp}`, null, {
        entityId: `delete_history_${treeId}_${year}_${timestamp}`,
      })

      // Si la requête a réussi ou a été mise en file d'attente
      if (!result._error || result._queued) {
        console.log(
          `[API] ✅ Entrée d'historique ${result._queued ? "marquée pour suppression" : "supprimée"} avec succès`,
        )

        // Supprimer l'entrée du stockage local
        await removeLocalHistoryEntry(treeId, year, timestamp)

        return {
          success: true,
          message: result._queued ? "Entrée marquée pour suppression (hors ligne)" : "Entrée supprimée avec succès",
        }
      }

      // En cas d'erreur
      console.error(`[API] ❌ Erreur lors de la suppression de l'entrée d'historique:`, result)
      return {
        success: false,
        message: result.message || "Erreur lors de la suppression de l'entrée d'historique",
      }
    } catch (error) {
      console.error(`[API] 💥 Erreur lors de la suppression de l'entrée d'historique:`, error)
      return {
        success: false,
        message: "Erreur lors de la suppression de l'entrée d'historique",
        error: error.message,
      }
    }
  },

  /**
   * Récupère les projets de l'utilisateur connecté
   * @param {Object} options - Options de filtrage (optionnel)
   * @returns {Promise<Object>} - Liste des projets
   */
  getUserProjects: async (options = {}) => {
    try {
      console.log("[API] 📋 Récupération des projets de l'utilisateur")

      // Construire l'endpoint avec les paramètres de filtrage
      let endpoint = "/projects"
      const params = new URLSearchParams()

      if (options.status) params.append("status", options.status)
      if (options.limit) params.append("limit", options.limit)
      if (options.offset) params.append("offset", options.offset)

      if (params.toString()) {
        endpoint += `?${params.toString()}`
      }

      const result = await request("GET", endpoint, null, { entityId: "user_projects" })

      // Si la requête a réussi
      if (result && !result._error && !result._queued) {
        console.log(`[API] ✅ ${result.length || 0} projets récupérés`)

        // Mettre en cache les projets
        await cacheUserProjects(result)

        return {
          success: true,
          projects: result,
          fromCache: false,
        }
      }

      // En cas d'erreur, essayer le cache local
      const cachedProjects = await getCachedUserProjects()
      if (cachedProjects) {
        console.log("[API] 💾 Utilisation des projets en cache")
        return {
          success: true,
          projects: cachedProjects,
          fromCache: true,
        }
      }

      return {
        success: false,
        message: "Aucun projet disponible",
        projects: [],
      }
    } catch (error) {
      console.error("[API] Erreur lors de la récupération des projets:", error)

      // Essayer le cache en cas d'erreur
      const cachedProjects = await getCachedUserProjects()
      if (cachedProjects) {
        return {
          success: true,
          projects: cachedProjects,
          fromCache: true,
          error: error.message,
        }
      }

      return {
        success: false,
        message: error.message || "Erreur lors de la récupération des projets",
        projects: [],
      }
    }
  },

  /**
   * Récupère les détails d'un projet spécifique
   * @param {string} projectId - ID du projet
   * @returns {Promise<Object>} - Détails du projet
   */
  getProjectDetails: async (projectId) => {
    try {
      console.log(`[API] 📄 Récupération des détails du projet ${projectId}`)

      const result = await request("GET", `/projects/${projectId}`, null, {
        entityId: `project_${projectId}`,
      })

      if (result && !result._error && !result._queued) {
        console.log(`[API] ✅ Détails du projet ${projectId} récupérés`)

        // Mettre en cache les détails du projet
        await cacheProjectDetails(projectId, result)

        return {
          success: true,
          project: result,
          fromCache: false,
        }
      }

      // Essayer le cache local
      const cachedProject = await getCachedProjectDetails(projectId)
      if (cachedProject) {
        console.log(`[API] 💾 Détails du projet ${projectId} trouvés en cache`)
        return {
          success: true,
          project: cachedProject,
          fromCache: true,
        }
      }

      return {
        success: false,
        message: `Projet ${projectId} non trouvé`,
      }
    } catch (error) {
      console.error(`[API] Erreur lors de la récupération du projet ${projectId}:`, error)

      // Essayer le cache
      const cachedProject = await getCachedProjectDetails(projectId)
      if (cachedProject) {
        return {
          success: true,
          project: cachedProject,
          fromCache: true,
          error: error.message,
        }
      }

      return {
        success: false,
        message: error.message || "Erreur lors de la récupération du projet",
      }
    }
  },

  /**
   * Récupère les arbres d'un projet
   * @param {string} projectId - ID du projet
   * @returns {Promise<Object>} - Liste des arbres du projet
   */
  getProjectTrees: async (projectId) => {
    try {
      console.log(`[API] 🌳 Récupération des arbres du projet ${projectId}`)

      const result = await request("GET", `/projects/${projectId}/trees`, null, {
        entityId: `project_trees_${projectId}`,
      })

      if (result && !result._error && !result._queued) {
        console.log(`[API] ✅ ${result.length || 0} arbres récupérés pour le projet ${projectId}`)

        // Mettre en cache les arbres du projet
        await cacheProjectTrees(projectId, result)

        return {
          success: true,
          trees: result,
          fromCache: false,
        }
      }

      // Essayer le cache local
      const cachedTrees = await getCachedProjectTrees(projectId)
      if (cachedTrees) {
        console.log(`[API] 💾 Arbres du projet ${projectId} trouvés en cache`)
        return {
          success: true,
          trees: cachedTrees,
          fromCache: true,
        }
      }

      return {
        success: false,
        message: `Aucun arbre trouvé pour le projet ${projectId}`,
        trees: [],
      }
    } catch (error) {
      console.error(`[API] Erreur lors de la récupération des arbres du projet ${projectId}:`, error)

      // Essayer le cache
      const cachedTrees = await getCachedProjectTrees(projectId)
      if (cachedTrees) {
        return {
          success: true,
          trees: cachedTrees,
          fromCache: true,
          error: error.message,
        }
      }

      return {
        success: false,
        message: error.message || "Erreur lors de la récupération des arbres",
        trees: [],
      }
    }
  },

  /**
   * Crée un nouveau projet
   * @param {Object} projectData - Données du projet
   * @returns {Promise<Object>} - Résultat de la création
   */
  createProject: async (projectData) => {
    try {
      console.log("[API] ➕ Création d'un nouveau projet")
      console.log("[API] 📊 Données du projet:", projectData)

      const result = await request("POST", "/projects", projectData, {
        entityId: `create_project_${Date.now()}`,
      })

      if (result && !result._error && !result._queued && !result._pendingSync) {
        console.log("[API] ✅ Projet créé avec succès")

        // Invalider le cache des projets pour forcer un rechargement
        await invalidateUserProjectsCache()

        return {
          success: true,
          message: "Projet créé avec succès",
          project: result,
          online: true,
        }
      }

      if (result._queued || result._pendingSync) {
        console.log("[API] 📴 Création de projet mise en file d'attente")
        return {
          success: true,
          message: "Projet créé en mode hors ligne",
          online: false,
        }
      }

      return {
        success: false,
        message: result.message || "Erreur lors de la création du projet",
      }
    } catch (error) {
      console.error("[API] Erreur lors de la création du projet:", error)
      return {
        success: false,
        message: error.message || "Erreur lors de la création du projet",
      }
    }
  },
}

/**
 * Met en cache les projets de l'utilisateur
 * @param {Array} projects - Liste des projets
 */
async function cacheUserProjects(projects) {
  try {
    const cacheKey = "user_projects"
    const cacheEntry = {
      data: projects,
      timestamp: Date.now(),
    }
    await AsyncStorage.setItem(`${CACHE_PREFIX}${cacheKey}`, JSON.stringify(cacheEntry))
    console.log("[API] 💾 Projets utilisateur mis en cache")
  } catch (error) {
    console.error("[API] Erreur lors de la mise en cache des projets:", error)
  }
}

/**
 * Récupère les projets en cache
 * @returns {Array|null} - Projets en cache ou null
 */
async function getCachedUserProjects() {
  try {
    const cacheKey = "user_projects"
    const cachedEntry = await AsyncStorage.getItem(`${CACHE_PREFIX}${cacheKey}`)

    if (cachedEntry) {
      const parsed = JSON.parse(cachedEntry)
      const age = Date.now() - parsed.timestamp
      const maxAge = 30 * 60 * 1000 // 30 minutes

      if (age < maxAge) {
        return parsed.data
      } else {
        await AsyncStorage.removeItem(`${CACHE_PREFIX}${cacheKey}`)
      }
    }

    return null
  } catch (error) {
    console.error("[API] Erreur lors de la récupération des projets en cache:", error)
    return null
  }
}

/**
 * Met en cache les détails d'un projet
 * @param {string} projectId - ID du projet
 * @param {Object} project - Détails du projet
 */
async function cacheProjectDetails(projectId, project) {
  try {
    const cacheKey = `project_details_${projectId}`
    const cacheEntry = {
      data: project,
      timestamp: Date.now(),
    }
    await AsyncStorage.setItem(`${CACHE_PREFIX}${cacheKey}`, JSON.stringify(cacheEntry))
    console.log(`[API] 💾 Détails du projet ${projectId} mis en cache`)
  } catch (error) {
    console.error(`[API] Erreur lors de la mise en cache du projet ${projectId}:`, error)
  }
}

/**
 * Récupère les détails d'un projet en cache
 * @param {string} projectId - ID du projet
 * @returns {Object|null} - Détails du projet ou null
 */
async function getCachedProjectDetails(projectId) {
  try {
    const cacheKey = `project_details_${projectId}`
    const cachedEntry = await AsyncStorage.getItem(`${CACHE_PREFIX}${cacheKey}`)

    if (cachedEntry) {
      const parsed = JSON.parse(cachedEntry)
      const age = Date.now() - parsed.timestamp
      const maxAge = 60 * 60 * 1000 // 1 heure

      if (age < maxAge) {
        return parsed.data
      } else {
        await AsyncStorage.removeItem(`${CACHE_PREFIX}${cacheKey}`)
      }
    }

    return null
  } catch (error) {
    console.error(`[API] Erreur lors de la récupération du projet ${projectId} en cache:`, error)
    return null
  }
}

/**
 * Met en cache les arbres d'un projet
 * @param {string} projectId - ID du projet
 * @param {Array} trees - Liste des arbres
 */
async function cacheProjectTrees(projectId, trees) {
  try {
    const cacheKey = `project_trees_${projectId}`
    const cacheEntry = {
      data: trees,
      timestamp: Date.now(),
    }
    await AsyncStorage.setItem(`${CACHE_PREFIX}${cacheKey}`, JSON.stringify(cacheEntry))
    console.log(`[API] 💾 Arbres du projet ${projectId} mis en cache`)
  } catch (error) {
    console.error(`[API] Erreur lors de la mise en cache des arbres du projet ${projectId}:`, error)
  }
}

/**
 * Récupère les arbres d'un projet en cache
 * @param {string} projectId - ID du projet
 * @returns {Array|null} - Arbres du projet ou null
 */
async function getCachedProjectTrees(projectId) {
  try {
    const cacheKey = `project_trees_${projectId}`
    const cachedEntry = await AsyncStorage.getItem(`${CACHE_PREFIX}${cacheKey}`)

    if (cachedEntry) {
      const parsed = JSON.parse(cachedEntry)
      const age = Date.now() - parsed.timestamp
      const maxAge = 30 * 60 * 1000 // 30 minutes

      if (age < maxAge) {
        return parsed.data
      } else {
        await AsyncStorage.removeItem(`${CACHE_PREFIX}${cacheKey}`)
      }
    }

    return null
  } catch (error) {
    console.error(`[API] Erreur lors de la récupération des arbres du projet ${projectId} en cache:`, error)
    return null
  }
}

/**
 * Invalide le cache des projets utilisateur
 */
async function invalidateUserProjectsCache() {
  try {
    const cacheKey = "user_projects"
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${cacheKey}`)
    console.log("[API] 🗑️ Cache des projets utilisateur invalidé")
  } catch (error) {
    console.error("[API] Erreur lors de l'invalidation du cache des projets:", error)
  }
}

/**
 * Nettoie le cache d'historique pour un arbre spécifique
 * @param {string} treeId - ID de l'arbre
 * @returns {Promise<boolean>} - Succès de l'opération
 */
async function clearHistoryCache(treeId) {
  try {
    const historyKey = `${HISTORY_PREFIX}${treeId}`
    await AsyncStorage.removeItem(historyKey)
    console.log(`[API] 🧹 Cache d'historique nettoyé pour l'arbre ${treeId}`)
    return true
  } catch (error) {
    console.error(`[API] Erreur lors du nettoyage du cache d'historique pour l'arbre ${treeId}:`, error)
    return false
  }
}

export default api
