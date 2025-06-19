

 import * as FileSystem from "expo-file-system"
import { isOnline } from "./network"
import AsyncStorage from "@react-native-async-storage/async-storage"

// Constantes pour la gestion du cache
const TILE_CACHE_DIRECTORY = `${FileSystem.cacheDirectory}map-tiles/`
const TILE_CACHE_INDEX_KEY = "map_tile_cache_index"
const MAX_CACHE_SIZE_MB = 100 // Taille maximale du cache en MB
const MAX_CACHE_AGE_DAYS = 30 // Durée maximale de conservation des tuiles en jours

/**
 * Service de mise en cache des tuiles de carte
 */
const mapCache = {
  /**
   * Initialise le répertoire de cache des tuiles
   */
  initialize: async () => {
    try {
      console.log("[MapCache] Initialisation du cache des tuiles...")

      // Vérifier si le répertoire de cache existe
      const dirInfo = await FileSystem.getInfoAsync(TILE_CACHE_DIRECTORY)

      if (!dirInfo.exists) {
        // Créer le répertoire s'il n'existe pas
        await FileSystem.makeDirectoryAsync(TILE_CACHE_DIRECTORY, { intermediates: true })
        console.log("[MapCache] Répertoire de cache créé:", TILE_CACHE_DIRECTORY)

        // Initialiser l'index du cache
        await AsyncStorage.setItem(TILE_CACHE_INDEX_KEY, JSON.stringify({}))
      } else {
        console.log("[MapCache] Répertoire de cache existant:", TILE_CACHE_DIRECTORY)
      }

      // Nettoyer le cache si nécessaire
      await mapCache.cleanCache()

      // Vérifier le contenu du cache
      const stats = await mapCache.getCacheStats()
      console.log("[MapCache] Statistiques du cache:", stats)

      console.log("[MapCache] Initialisation terminée")
      return true
    } catch (error) {
      console.error("[MapCache] Erreur lors de l'initialisation:", error)
      return false
    }
  },

  /**
   * Récupère une tuile, depuis le cache si disponible, sinon depuis le réseau
   * @param {string} url - URL de la tuile
   * @returns {Promise<string>} - URI local de la tuile
   */
  getTile: async (url) => {
    try {
      // Générer le nom de fichier à partir de l'URL
      const fileName = mapCache.urlToFileName(url)
      const filePath = `${TILE_CACHE_DIRECTORY}${fileName}`

      // Vérifier si la tuile existe dans le cache
      const fileInfo = await FileSystem.getInfoAsync(filePath)

      if (fileInfo.exists) {
        // Mettre à jour la date d'accès dans l'index
        await mapCache.updateTileAccess(fileName)
        console.log(`[MapCache] Tuile récupérée depuis le cache: ${fileName}`)

        // Retourner l'URI local avec le préfixe file://
        return fileInfo.uri
      }

      // Si la tuile n'est pas en cache, vérifier si nous sommes en ligne
      const online = await isOnline()

      if (!online) {
        console.log(`[MapCache] Hors ligne et tuile non mise en cache: ${fileName}`)
        // Retourner une tuile vide ou par défaut si disponible
        return mapCache.getDefaultTile()
      }

      // Télécharger la tuile depuis le réseau
      console.log(`[MapCache] Téléchargement de la tuile: ${url}`)
      const downloadResult = await FileSystem.downloadAsync(url, filePath)

      // Ajouter la tuile à l'index
      await mapCache.addTileToIndex(fileName, url)

      console.log(`[MapCache] Tuile téléchargée et mise en cache: ${fileName}`)
      return downloadResult.uri
    } catch (error) {
      console.error(`[MapCache] Erreur lors de la récupération de la tuile:`, error)
      // En cas d'erreur, retourner une tuile par défaut
      return mapCache.getDefaultTile()
    }
  },

  /**
   * Précharge les tuiles pour une région spécifique
   * @param {Object} region - Région à précharger (minLat, maxLat, minLon, maxLon)
   * @param {number} minZoom - Niveau de zoom minimum
   * @param {number} maxZoom - Niveau de zoom maximum
   * @returns {Promise<{success: boolean, count: number, errors: number}>}
   */
  preloadRegion: async (region, minZoom = 12, maxZoom = 16) => {
    try {
      console.log("[MapCache] Début du préchargement de la région:", region)

      // Vérifier si nous sommes en ligne
      const online = await isOnline()

      if (!online) {
        console.log("[MapCache] Impossible de précharger les tuiles: hors ligne")
        return { success: false, count: 0, errors: 0 }
      }

      const { minLat, maxLat, minLon, maxLon } = region
      let downloadedCount = 0
      let errorCount = 0
      let skippedCount = 0

      // Pour chaque niveau de zoom
      for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
        // Calculer les indices de tuiles pour la région
        const minX = Math.floor(((minLon + 180) / 360) * Math.pow(2, zoom))
        const maxX = Math.floor(((maxLon + 180) / 360) * Math.pow(2, zoom))
        const minY = Math.floor(
          ((1 - Math.log(Math.tan((maxLat * Math.PI) / 180) + 1 / Math.cos((maxLat * Math.PI) / 180)) / Math.PI) / 2) *
            Math.pow(2, zoom),
        )
        const maxY = Math.floor(
          ((1 - Math.log(Math.tan((minLat * Math.PI) / 180) + 1 / Math.cos((minLat * Math.PI) / 180)) / Math.PI) / 2) *
            Math.pow(2, zoom),
        )

        console.log(`[MapCache] Préchargement du zoom ${zoom}: ${minX}-${maxX}, ${minY}-${maxY}`)

        // Télécharger chaque tuile
        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            try {
              // Construire l'URL de la tuile
              const url = `https://a.tile.openstreetmap.org/${zoom}/${x}/${y}.png`

              // Générer le nom de fichier
              const fileName = mapCache.urlToFileName(url)
              const filePath = `${TILE_CACHE_DIRECTORY}${fileName}`

              // Vérifier si la tuile existe déjà
              const fileInfo = await FileSystem.getInfoAsync(filePath)

              if (!fileInfo.exists) {
                // Télécharger la tuile
                await FileSystem.downloadAsync(url, filePath)

                // Ajouter la tuile à l'index
                await mapCache.addTileToIndex(fileName, url)

                downloadedCount++

                // Petite pause pour éviter de surcharger le serveur
                if (downloadedCount % 10 === 0) {
                  await new Promise((resolve) => setTimeout(resolve, 500))
                  console.log(`[MapCache] Progression: ${downloadedCount} tuiles téléchargées`)
                }
              } else {
                skippedCount++
              }
            } catch (error) {
              console.error(`[MapCache] Erreur lors du préchargement de la tuile (${zoom}/${x}/${y}):`, error)
              errorCount++
            }
          }
        }
      }

      console.log(
        `[MapCache] Préchargement terminé: ${downloadedCount} tuiles téléchargées, ${skippedCount} déjà en cache, ${errorCount} erreurs`,
      )
      return { success: true, count: downloadedCount, skipped: skippedCount, errors: errorCount }
    } catch (error) {
      console.error("[MapCache] Erreur lors du préchargement de la région:", error)
      return { success: false, count: 0, errors: 1 }
    }
  },

  /**
   * Nettoie le cache en supprimant les tuiles les plus anciennes si nécessaire
   */
  cleanCache: async () => {
    try {
      // Récupérer l'index du cache
      const indexString = await AsyncStorage.getItem(TILE_CACHE_INDEX_KEY)

      if (!indexString) {
        return
      }

      const index = JSON.parse(indexString)

      // Calculer la taille totale du cache
      let totalSize = 0
      const now = new Date()
      const tilesToDelete = []

      for (const fileName in index) {
        const tileInfo = index[fileName]

        // Vérifier l'âge de la tuile
        const lastAccess = new Date(tileInfo.lastAccess)
        const ageInDays = (now - lastAccess) / (1000 * 60 * 60 * 24)

        if (ageInDays > MAX_CACHE_AGE_DAYS) {
          // Marquer pour suppression si trop ancienne
          tilesToDelete.push(fileName)
        } else {
          totalSize += tileInfo.size || 0
        }
      }

      // Supprimer les tuiles trop anciennes
      for (const fileName of tilesToDelete) {
        await mapCache.removeTileFromCache(fileName)
        delete index[fileName]
      }

      // Si le cache est toujours trop grand, supprimer les tuiles les moins récemment utilisées
      if (totalSize > MAX_CACHE_SIZE_MB * 1024 * 1024) {
        // Trier les tuiles par date d'accès
        const sortedTiles = Object.entries(index)
          .map(([fileName, info]) => ({ fileName, lastAccess: new Date(info.lastAccess), size: info.size || 0 }))
          .sort((a, b) => a.lastAccess - b.lastAccess)

        // Supprimer les tuiles les plus anciennes jusqu'à ce que la taille soit acceptable
        let currentSize = totalSize
        for (const tile of sortedTiles) {
          if (currentSize <= MAX_CACHE_SIZE_MB * 1024 * 1024) {
            break
          }

          await mapCache.removeTileFromCache(tile.fileName)
          delete index[tile.fileName]
          currentSize -= tile.size
        }
      }

      // Mettre à jour l'index
      await AsyncStorage.setItem(TILE_CACHE_INDEX_KEY, JSON.stringify(index))

      console.log("[MapCache] Nettoyage du cache terminé")
    } catch (error) {
      console.error("[MapCache] Erreur lors du nettoyage du cache:", error)
    }
  },

  /**
   * Vide complètement le cache
   * @returns {Promise<boolean>}
   */
  clearCache: async () => {
    try {
      // Supprimer le répertoire de cache
      await FileSystem.deleteAsync(TILE_CACHE_DIRECTORY, { idempotent: true })

      // Recréer le répertoire
      await FileSystem.makeDirectoryAsync(TILE_CACHE_DIRECTORY, { intermediates: true })

      // Réinitialiser l'index
      await AsyncStorage.setItem(TILE_CACHE_INDEX_KEY, JSON.stringify({}))

      console.log("[MapCache] Cache vidé avec succès")
      return true
    } catch (error) {
      console.error("[MapCache] Erreur lors de la suppression du cache:", error)
      return false
    }
  },

  /**
   * Retourne des statistiques sur le cache
   * @returns {Promise<Object>}
   */
  getCacheStats: async () => {
    try {
      // Récupérer l'index du cache
      const indexString = await AsyncStorage.getItem(TILE_CACHE_INDEX_KEY)

      if (!indexString) {
        return { tileCount: 0, totalSize: 0, oldestTile: null, newestTile: null }
      }

      const index = JSON.parse(indexString)
      const tileCount = Object.keys(index).length

      if (tileCount === 0) {
        return { tileCount: 0, totalSize: 0, oldestTile: null, newestTile: null }
      }

      // Calculer la taille totale et trouver les tuiles les plus anciennes/récentes
      let totalSize = 0
      let oldestDate = new Date()
      let newestDate = new Date(0)
      let oldestTile = null
      let newestTile = null

      for (const fileName in index) {
        const tileInfo = index[fileName]
        totalSize += tileInfo.size || 0

        const accessDate = new Date(tileInfo.lastAccess)

        if (accessDate < oldestDate) {
          oldestDate = accessDate
          oldestTile = { fileName, url: tileInfo.url, date: accessDate }
        }

        if (accessDate > newestDate) {
          newestDate = accessDate
          newestTile = { fileName, url: tileInfo.url, date: accessDate }
        }
      }

      return {
        tileCount,
        totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        oldestTile,
        newestTile,
      }
    } catch (error) {
      console.error("[MapCache] Erreur lors de la récupération des statistiques du cache:", error)
      return { tileCount: 0, totalSize: 0, oldestTile: null, newestTile: null }
    }
  },

  /**
   * Convertit une URL de tuile en nom de fichier
   * @param {string} url - URL de la tuile
   * @returns {string} - Nom de fichier
   */
  urlToFileName: (url) => {
    // Remplacer les caractères non autorisés dans les noms de fichiers
    return url
      .replace(/^https?:\/\//, "")
      .replace(/\//g, "_")
      .replace(/\./g, "-")
      .replace(/\?/g, "-")
      .replace(/&/g, "-")
      .replace(/=/g, "-")
  },

  /**
   * Ajoute une tuile à l'index du cache
   * @param {string} fileName - Nom du fichier
   * @param {string} url - URL de la tuile
   */
  addTileToIndex: async (fileName, url) => {
    try {
      // Récupérer l'index existant
      const indexString = await AsyncStorage.getItem(TILE_CACHE_INDEX_KEY)
      const index = indexString ? JSON.parse(indexString) : {}

      // Obtenir les informations sur le fichier
      const fileInfo = await FileSystem.getInfoAsync(TILE_CACHE_DIRECTORY + fileName)

      // Ajouter la tuile à l'index
      index[fileName] = {
        url,
        size: fileInfo.size || 0,
        created: new Date().toISOString(),
        lastAccess: new Date().toISOString(),
      }

      // Sauvegarder l'index mis à jour
      await AsyncStorage.setItem(TILE_CACHE_INDEX_KEY, JSON.stringify(index))
    } catch (error) {
      console.error("[MapCache] Erreur lors de l'ajout de la tuile à l'index:", error)
    }
  },

  /**
   * Met à jour la date d'accès d'une tuile dans l'index
   * @param {string} fileName - Nom du fichier
   */
  updateTileAccess: async (fileName) => {
    try {
      // Récupérer l'index existant
      const indexString = await AsyncStorage.getItem(TILE_CACHE_INDEX_KEY)

      if (!indexString) {
        return
      }

      const index = JSON.parse(indexString)

      // Mettre à jour la date d'accès si la tuile existe dans l'index
      if (index[fileName]) {
        index[fileName].lastAccess = new Date().toISOString()

        // Sauvegarder l'index mis à jour
        await AsyncStorage.setItem(TILE_CACHE_INDEX_KEY, JSON.stringify(index))
      }
    } catch (error) {
      console.error("[MapCache] Erreur lors de la mise à jour de la date d'accès:", error)
    }
  },

  /**
   * Supprime une tuile du cache
   * @param {string} fileName - Nom du fichier
   */
  removeTileFromCache: async (fileName) => {
    try {
      // Supprimer le fichier
      await FileSystem.deleteAsync(TILE_CACHE_DIRECTORY + fileName, { idempotent: true })
    } catch (error) {
      console.error(`[MapCache] Erreur lors de la suppression de la tuile ${fileName}:`, error)
    }
  },

  /**
   * Retourne une tuile par défaut pour les cas où la tuile demandée n'est pas disponible
   * @returns {string} - URI de la tuile par défaut
   */
  getDefaultTile: () => {
    // Retourner une tuile vide ou par défaut
    // Dans une implémentation réelle, vous pourriez avoir une tuile par défaut stockée dans les assets
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
  },
}

export default mapCache
