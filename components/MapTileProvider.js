"use client"

import { useEffect, useState, createContext, useContext, useCallback } from "react"
import { View, Text, StyleSheet, ActivityIndicator } from "react-native"
import mapCache from "../services/mapCache"
import { isOnline } from "../services/network"

// Créer un contexte pour le fournisseur de tuiles
const MapTileContext = createContext({
  getTileUrl: async (url) => url,
  isOfflineMode: false,
  cacheStats: { tileCount: 0, totalSizeMB: "0" },
  preloadRegion: async () => ({ success: false }),
  clearCache: async () => false,
})

/**
 * Hook personnalisé pour utiliser le contexte du fournisseur de tuiles
 */
export const useMapTiles = () => useContext(MapTileContext)

/**
 * Composant fournisseur de tuiles de carte
 * Gère la mise en cache des tuiles et fournit des méthodes pour les récupérer
 */
export const MapTileProvider = ({ children }) => {
  const [initialized, setInitialized] = useState(false)
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const [cacheStats, setCacheStats] = useState({ tileCount: 0, totalSizeMB: "0" })
  const [error, setError] = useState(null)

  // Vérifie périodiquement l'état de la connexion
  const checkNetworkStatus = useCallback(async () => {
    try {
      const online = await isOnline()
      setIsOfflineMode(!online)
    } catch (err) {
      console.error("[MapTileProvider] Erreur vérification réseau:", err)
    }
  }, [])

  // Initialiser le cache des tuiles au montage du composant
  useEffect(() => {
    const init = async () => {
      try {
        // Initialiser le cache
        await mapCache.initialize()

        // Vérifier l'état de la connexion
        await checkNetworkStatus()

        // Récupérer les statistiques du cache
        const stats = await mapCache.getCacheStats()
        setCacheStats(stats)

        setInitialized(true)
      } catch (err) {
        console.error("[MapTileProvider] Erreur lors de l'initialisation:", err)
        setError("Impossible d'initialiser le cache des tuiles")
      }
    }

    init()

    // Configurer un intervalle pour vérifier l'état de la connexion
    const checkNetworkInterval = setInterval(checkNetworkStatus, 10000)

    return () => {
      clearInterval(checkNetworkInterval)
    }
  }, [checkNetworkStatus])

  // Mettre à jour les statistiques du cache périodiquement
  useEffect(() => {
    if (!initialized) return

    const updateStats = async () => {
      try {
        const stats = await mapCache.getCacheStats()
        setCacheStats(stats)
      } catch (err) {
        console.error("[MapTileProvider] Erreur mise à jour stats:", err)
      }
    }

    const updateStatsInterval = setInterval(updateStats, 60000)
    return () => clearInterval(updateStatsInterval)
  }, [initialized])

  /**
   * Récupère l'URL d'une tuile, depuis le cache si disponible
   */
  const getTileUrl = useCallback(async (url) => {
    if (!initialized) return url

    try {
      // Toujours essayer de récupérer depuis le cache
      const localUrl = await mapCache.getTile(url)
      return localUrl
    } catch (cacheError) {
      // En mode hors ligne, retourner une tuile par défaut
      if (isOfflineMode) {
        return mapCache.getDefaultTile()
      }
      // En mode en ligne, retourner l'URL distante
      return url
    }
  }, [initialized, isOfflineMode])

  /**
   * Précharge les tuiles pour une région spécifique
   */
  const preloadRegion = useCallback(async (region, minZoom = 12, maxZoom = 16) => {
    if (!initialized) return { success: false, message: "Cache non initialisé" }

    try {
      const result = await mapCache.preloadRegion(region, minZoom, maxZoom)

      // Mettre à jour les statistiques après le préchargement
      const stats = await mapCache.getCacheStats()
      setCacheStats(stats)

      return result
    } catch (err) {
      console.error("[MapTileProvider] Erreur préchargement région:", err)
      return { success: false, message: err.message }
    }
  }, [initialized])

  /**
   * Vide le cache des tuiles
   */
  const clearCache = useCallback(async () => {
    if (!initialized) return false

    try {
      const result = await mapCache.clearCache()

      // Mettre à jour les statistiques après la suppression
      const stats = await mapCache.getCacheStats()
      setCacheStats(stats)

      return result
    } catch (err) {
      console.error("[MapTileProvider] Erreur suppression cache:", err)
      return false
    }
  }, [initialized])

  // Valeur du contexte
  const contextValue = {
    getTileUrl,
    isOfflineMode,
    cacheStats,
    preloadRegion,
    clearCache,
    initialized // Ajouté pour le débogage
  }

  // Si une erreur s'est produite lors de l'initialisation
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )
  }

  // Si l'initialisation est en cours
  if (!initialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00C853" />
        <Text style={styles.loadingText}>Initialisation du cache des tuiles...</Text>
      </View>
    )
  }

  return <MapTileContext.Provider value={contextValue}>{children}</MapTileContext.Provider>
}


const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#222",
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#222",
    padding: 20,
  },
  errorText: {
    color: "#FF5252",
    textAlign: "center",
    fontSize: 16,
  },
})

export default MapTileProvider
