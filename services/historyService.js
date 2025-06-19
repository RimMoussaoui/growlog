import api from "./api"
import AsyncStorage from "@react-native-async-storage/async-storage"

// Modifier la fonction getAvailableYears pour mieux gérer les formats de réponse
export const getAvailableYears = async (treeId) => {
  try {
    console.log(`[HistoryService] 📅 Récupération des années disponibles pour l'arbre ${treeId}`)

    // Utiliser le service API pour récupérer l'historique complet
    const history = await api.getTreeHistory(treeId)
    console.log(`[HistoryService] 📋 Historique complet récupéré:`, JSON.stringify(history, null, 2))

    // Extraire les années disponibles
    if (history && typeof history === "object" && !history._error) {
      // Filtrer les clés qui sont des années (nombres de 4 chiffres)
      const years = Object.keys(history)
        .filter((key) => !key.startsWith("_") && /^\d{4}$/.test(key))
        .sort((a, b) => b - a) // Trier par ordre décroissant (plus récent en premier)

      console.log(`[HistoryService] ✅ Années disponibles:`, years)
      return years
    }

    // Si l'historique est un tableau (format alternatif)
    if (Array.isArray(history)) {
      const years = [...new Set(history.map((entry) => new Date(entry.date).getFullYear().toString()))].sort(
        (a, b) => b - a,
      )

      console.log(`[HistoryService] ✅ Années disponibles (format tableau):`, years)
      return years
    }

    // Si l'historique est un objet avec une propriété "2025" (ou autre année)
    if (history && typeof history === "object") {
      const potentialYears = Object.keys(history).filter((key) => /^\d{4}$/.test(key))
      if (potentialYears.length > 0) {
        console.log(`[HistoryService] ✅ Années trouvées dans l'objet:`, potentialYears)
        return potentialYears.sort((a, b) => b - a)
      }
    }

    // Essayer de récupérer depuis le stockage local
    try {
      const localYears = await getLocalAvailableYears(treeId)
      if (localYears.length > 0) {
        console.log(`[HistoryService] 💾 Années disponibles localement:`, localYears)
        return localYears
      }
    } catch (localError) {
      console.error(`[HistoryService] Erreur lors de la récupération locale des années:`, localError)
    }

    console.log(`[HistoryService] ❌ Aucune année disponible`)
    return []
  } catch (error) {
    console.error(`[HistoryService] 💥 Erreur lors de la récupération des années disponibles:`, error)

    // En cas d'erreur, essayer le stockage local
    try {
      const localYears = await getLocalAvailableYears(treeId)
      console.log(`[HistoryService] 💾 Récupération locale en cas d'erreur:`, localYears)
      return localYears
    } catch (localError) {
      console.error(`[HistoryService] Erreur lors de la récupération locale:`, localError)
      return []
    }
  }
}

// Ajouter cette fonction pour récupérer les années disponibles localement
const getLocalAvailableYears = async (treeId) => {
  try {
    const historyKey = `tree_history_${treeId}`
    const historyString = await AsyncStorage.getItem(historyKey)

    if (!historyString) {
      return []
    }

    const history = JSON.parse(historyString)

    // Si l'historique est un objet avec des années comme clés
    if (typeof history === "object" && !Array.isArray(history)) {
      const years = Object.keys(history)
        .filter((key) => /^\d{4}$/.test(key))
        .sort((a, b) => b - a)
      return years
    }

    // Si l'historique est un tableau
    if (Array.isArray(history)) {
      const years = [...new Set(history.map((entry) => new Date(entry.date).getFullYear().toString()))].sort(
        (a, b) => b - a,
      )
      return years
    }

    return []
  } catch (error) {
    console.error(`[HistoryService] Erreur lors de la récupération des années locales:`, error)
    return []
  }
}

/**
 * Récupère l'historique d'un arbre pour une année spécifique
 * @param {string} treeId - ID de l'arbre
 * @param {string} year - Année
 * @returns {Promise<Array>} - Liste des entrées d'historique
 */
export const getHistoryForYear = async (treeId, year) => {
  try {
    console.log(`[HistoryService] 📚 Récupération de l'historique pour l'arbre ${treeId}, année ${year}`)

    // Utiliser le service API pour récupérer l'historique
    const history = await api.getTreeHistory(treeId, year)
    console.log(`[HistoryService] 📋 Réponse de l'API:`, JSON.stringify(history, null, 2))

    // Fonction pour normaliser une entrée d'historique
    const normalizeEntry = (entry, index) => ({
      id: entry.id || entry.timestamp || `entry_${index}_${Date.now()}`,
      date: entry.date,
      height: entry.height || null,
      diameter: entry.diameter || null,
      health: entry.health || null,
      notes: entry.notes || "",
      oliveQuantity: entry.oliveQuantity || null,
      oilQuantity: entry.oilQuantity || null,
      observations: Array.isArray(entry.observations) ? entry.observations : [],
      images: Array.isArray(entry.images) ? entry.images : [],
      recordedBy: entry.recordedBy || entry.addedBy || "Utilisateur",
      timestamp: entry.timestamp || Date.now(),
      isOffline: entry.isOffline || history._fromLocal || false,
    })

    // Vérifier si nous avons des données
    if (history && !history._error) {
      // Format standard : objet avec années comme clés
      if (history[year] && Array.isArray(history[year])) {
        console.log(`[HistoryService] ✅ ${history[year].length} entrées trouvées pour l'année ${year}`)
        return history[year].map(normalizeEntry)
      }

      // Format alternatif : tableau d'entrées
      if (Array.isArray(history)) {
        const entriesForYear = history.filter((entry) => {
          const entryYear = new Date(entry.date).getFullYear().toString()
          return entryYear === year
        })

        if (entriesForYear.length > 0) {
          console.log(
            `[HistoryService] ✅ ${entriesForYear.length} entrées trouvées pour l'année ${year} (format tableau)`,
          )
          return entriesForYear.map(normalizeEntry)
        }
      }

      // Si nous avons un objet mais pas pour cette année
      if (typeof history === "object") {
        const availableYears = Object.keys(history).filter((key) => !key.startsWith("_"))
        console.log(`[HistoryService] 🔍 Années disponibles dans la réponse:`, availableYears)
      }
    }

    // Essayer de récupérer depuis le stockage local
    console.log(`[HistoryService] 💾 Tentative de récupération locale pour l'année ${year}`)
    const localEntries = await getLocalHistoryForYear(treeId, year)
    if (localEntries && localEntries.length > 0) {
      console.log(`[HistoryService] ✅ ${localEntries.length} entrées locales trouvées pour l'année ${year}`)
      return localEntries
    }

    console.log(`[HistoryService] ❌ Aucune entrée trouvée pour l'année ${year}`)
    return []
  } catch (error) {
    console.error(`[HistoryService] 💥 Erreur lors de la récupération de l'historique:`, error)

    // En cas d'erreur, essayer le stockage local
    try {
      const localEntries = await getLocalHistoryForYear(treeId, year)
      if (localEntries && localEntries.length > 0) {
        console.log(`[HistoryService] 💾 Données locales récupérées en cas d'erreur: ${localEntries.length} entrées`)
        return localEntries
      }
    } catch (localError) {
      console.error(`[HistoryService] Erreur lors de la récupération locale:`, localError)
    }

    return []
  }
}

/**
 * Récupère l'historique d'un arbre pour une année spécifique depuis le stockage local
 * @param {string} treeId - ID de l'arbre
 * @param {string} year - Année
 * @returns {Promise<Array>} - Liste des entrées d'historique locales
 */
const getLocalHistoryForYear = async (treeId, year) => {
  try {
    const historyKey = `tree_history_${treeId}`
    const historyString = await AsyncStorage.getItem(historyKey)

    if (!historyString) {
      return []
    }

    const history = JSON.parse(historyString)

    if (history && history[year] && Array.isArray(history[year])) {
      return history[year]
    }

    return []
  } catch (error) {
    console.error(`[HistoryService] Erreur lors de la récupération de l'historique local pour l'année:`, error)
    return []
  }
}

/**
 * Ajoute une entrée à l'historique d'un arbre
 * @param {string} treeId - ID de l'arbre
 * @param {Object} historyEntry - Entrée d'historique à ajouter
 * @returns {Promise<Object>} - Résultat de l'opération
 */
export const addHistoryToTree = async (treeId, historyEntry) => {
  try {
    console.log(`[HistoryService] Ajout d'une entrée d'historique pour l'arbre ${treeId}`)

    // S'assurer que l'entrée a un timestamp
    if (!historyEntry.timestamp) {
      historyEntry.timestamp = Date.now()
    }

    // Utiliser le service API pour ajouter l'entrée
    const result = await api.addTreeHistoryEntry(treeId, historyEntry)

    if (result.success) {
      console.log(`[HistoryService] Entrée ajoutée avec succès${result.entry?.isOffline ? " (mode hors ligne)" : ""}`)
      return { success: true, entry: result.entry }
    } else {
      console.error(`[HistoryService] Erreur lors de l'ajout de l'entrée:`, result.message)
      throw new Error(result.message || "Échec de la sauvegarde")
    }
  } catch (error) {
    console.error(`[HistoryService] Erreur lors de l'ajout de l'entrée d'historique:`, error)
    throw error
  }
}

/**
 * Supprime une entrée de l'historique d'un arbre
 * @param {string} treeId - ID de l'arbre
 * @param {string} entryId - ID de l'entrée à supprimer
 * @returns {Promise<Object>} - Résultat de l'opération
 */
export const deleteHistoryEntry = async (treeId, entryId) => {
  try {
    console.log(`[HistoryService] Suppression de l'entrée d'historique ${entryId} pour l'arbre ${treeId}`)

    // Extraire l'année et le timestamp de l'ID
    // Format attendu: entry_timestamp ou ID généré par l'API
    let timestamp
    let year

    if (entryId.startsWith("entry_")) {
      timestamp = entryId.replace("entry_", "")
      // Déterminer l'année à partir du timestamp
      year = new Date(Number(timestamp)).getFullYear().toString()
    } else {
      // Récupérer toutes les années pour trouver l'entrée
      const history = await api.getTreeHistory(treeId)

      // Parcourir toutes les années pour trouver l'entrée
      let found = false
      Object.keys(history).forEach((y) => {
        if (history[y] && Array.isArray(history[y])) {
          const entry = history[y].find((e) => e.id === entryId || `entry_${e.timestamp}` === entryId)
          if (entry) {
            year = y
            timestamp = entry.timestamp
            found = true
          }
        }
      })

      if (!found) {
        throw new Error("Entrée d'historique introuvable")
      }
    }

    // Utiliser le service API pour supprimer l'entrée
    const result = await api.deleteTreeHistoryEntry(treeId, year, timestamp)

    if (result.success) {
      console.log(`[HistoryService] Entrée supprimée avec succès`)
      return { success: true }
    } else {
      console.error(`[HistoryService] Erreur lors de la suppression de l'entrée:`, result.message)
      throw new Error(result.message || "Échec de la suppression")
    }
  } catch (error) {
    console.error(`[HistoryService] Erreur lors de la suppression de l'entrée d'historique:`, error)
    throw error
  }
}

/**
 * Fonction de débogage pour afficher l'historique d'un arbre
 * @param {string} treeId - ID de l'arbre
 */
export const debugHistory = async (treeId) => {
  try {
    const historyKey = `tree_history_${treeId}`
    const historyString = await AsyncStorage.getItem(historyKey)
    console.log(`[HistoryService] Débogage de l'historique pour l'arbre ${treeId}:`)
    console.log(historyString ? JSON.parse(historyString) : "Aucun historique trouvé")

    // Récupérer aussi depuis l'API pour comparer
    try {
      const apiHistory = await api.getTreeHistory(treeId)
      console.log(`[HistoryService] Historique API pour l'arbre ${treeId}:`, apiHistory)
    } catch (e) {
      console.log(`[HistoryService] Impossible de récupérer l'historique API:`, e)
    }
  } catch (error) {
    console.error(`[HistoryService] Erreur lors du débogage de l'historique:`, error)
  }
}

/**
 * Synchronise l'historique local avec l'API
 * @param {string} treeId - ID de l'arbre
 * @returns {Promise<Object>} - Résultat de la synchronisation
 */
export const syncHistoryWithAPI = async (treeId) => {
  try {
    console.log(`[HistoryService] Synchronisation de l'historique pour l'arbre ${treeId}`)

    // Forcer la récupération depuis l'API
    const apiHistory = await api.getTreeHistory(treeId)

    if (apiHistory && !apiHistory._error) {
      console.log(`[HistoryService] Historique récupéré avec succès depuis l'API`)
      return { success: true, message: "Historique synchronisé avec succès" }
    } else {
      console.error(`[HistoryService] Erreur lors de la synchronisation:`, apiHistory._error)
      return { success: false, message: "Impossible de synchroniser l'historique" }
    }
  } catch (error) {
    console.error(`[HistoryService] Erreur lors de la synchronisation:`, error)
    return { success: false, message: "Erreur lors de la synchronisation" }
  }
}

/**
 * Charge l'historique d'un arbre
 * @param {string} treeId - ID de l'arbre
 * @param {boolean} forceSync - Forcer la synchronisation avec l'API
 * @returns {Promise<Object>} - Historique de l'arbre
 */
export const loadHistory = async (treeId, forceSync = false) => {
  try {
    console.log(`[HistoryService] Chargement de l'historique pour l'arbre ${treeId}`)

    if (forceSync) {
      await syncHistoryWithAPI(treeId)
    }

    // Récupérer l'historique
    const history = await api.getTreeHistory(treeId)

    if (history && !history._error) {
      return history
    }

    return {}
  } catch (error) {
    console.error(`[HistoryService] Erreur lors du chargement de l'historique:`, error)
    return {}
  }
}
