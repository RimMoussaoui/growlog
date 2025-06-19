import NetInfo from "@react-native-community/netinfo"
import AsyncStorage from "@react-native-async-storage/async-storage"

const OFFLINE_QUEUE_KEY = "offline_queue"

/**
 * Vérifie si l'appareil est connecté à Internet
 * @returns {Promise<boolean>} - True si connecté, false sinon
 */
export const isOnline = async () => {
  try {
    const netInfo = await NetInfo.fetch()
    const connected = netInfo.isConnected && netInfo.isInternetReachable
    console.log(`[Network] État de connexion: ${connected ? "✅ En ligne" : "❌ Hors ligne"}`)
    return connected
  } catch (error) {
    console.error("[Network] Erreur lors de la vérification de la connexion:", error)
    // En cas d'erreur, assumer qu'on est hors ligne
    return false
  }
}

/**
 * Force une vérification de la connectivité réseau
 * @returns {Promise<boolean>} - True si connecté, false sinon
 */
export const forceNetworkCheck = async () => {
  try {
    console.log("[Network] 🔄 Vérification forcée de la connectivité...")

    // Vérifier avec NetInfo
    const netInfo = await NetInfo.fetch()
    const isConnected = netInfo.isConnected && netInfo.isInternetReachable

    if (!isConnected) {
      console.log("[Network] ❌ Pas de connexion réseau détectée")
      return false
    }

    // Test de ping vers un serveur fiable
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch("https://www.google.com/favicon.ico", {
        method: "HEAD",
        signal: controller.signal,
        cache: "no-cache",
      })

      clearTimeout(timeoutId)
      const online = response.ok

      console.log(`[Network] ${online ? "✅" : "❌"} Test de ping: ${online ? "Succès" : "Échec"}`)
      return online
    } catch (pingError) {
      console.log("[Network] ❌ Test de ping échoué:", pingError.message)
      return false
    }
  } catch (error) {
    console.error("[Network] Erreur lors de la vérification forcée:", error)
    return false
  }
}

/**
 * Ajoute une requête à la file d'attente hors ligne
 * @param {Object} request - Requête à ajouter
 */
export const addToOfflineQueue = async (request) => {
  try {
    const queue = await getOfflineQueue()
    queue.push({
      ...request,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    })

    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
    console.log(`[Network] 📝 Requête ajoutée à la file d'attente (${queue.length} éléments)`)
  } catch (error) {
    console.error("[Network] Erreur lors de l'ajout à la file d'attente:", error)
  }
}

/**
 * Récupère la file d'attente des requêtes hors ligne
 * @returns {Promise<Array>} - File d'attente des requêtes
 */
export const getOfflineQueue = async () => {
  try {
    const queueString = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY)
    return queueString ? JSON.parse(queueString) : []
  } catch (error) {
    console.error("[Network] Erreur lors de la récupération de la file d'attente:", error)
    return []
  }
}

/**
 * Supprime une requête de la file d'attente
 * @param {string} entityId - ID de l'entité à supprimer
 */
export const removeFromOfflineQueue = async (entityId) => {
  try {
    const queue = await getOfflineQueue()
    const filteredQueue = queue.filter((item) => item.entityId !== entityId && item.id !== entityId)

    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filteredQueue))
    console.log(`[Network] 🗑️ Requête supprimée de la file d'attente`)
  } catch (error) {
    console.error("[Network] Erreur lors de la suppression de la file d'attente:", error)
  }
}

/**
 * Vide complètement la file d'attente
 */
export const clearOfflineQueue = async () => {
  try {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY)
    console.log("[Network] 🧹 File d'attente vidée")
  } catch (error) {
    console.error("[Network] Erreur lors du vidage de la file d'attente:", error)
  }
}
