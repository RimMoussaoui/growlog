"use client"

import { Ionicons } from "@expo/vector-icons"
import { useState, useEffect } from "react"
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Animated,
    Easing
} from "react-native"
import { useMapTiles } from "../components/MapTileProvider"
import NetworkStatus from "../components/NetworkStatus"
import { isOnline } from "../services/network"

const MapCacheScreen = ({ navigation }) => {
  const { 
    initialized, 
    cacheStats, 
    preloadRegion, 
    clearCache, 
    isOfflineMode 
  } = useMapTiles()

  if (!initialized) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3A7D44" />
        <Text>Initialisation en cours...</Text>
      </View>
    )
  }

  const [loading, setLoading] = useState(false)
  const [preloading, setPreloading] = useState(false)
  const [preloadProgress, setPreloadProgress] = useState(null)
  const [customRegion, setCustomRegion] = useState({
    minLat: "43.5",
    maxLat: "43.7",
    minLon: "3.8",
    maxLon: "4.0",
    minZoom: "12",
    maxZoom: "16",
  })
  const [errors, setErrors] = useState({})
  const progressAnim = useState(new Animated.Value(0))[0]

  // Valider les champs de la région personnalisée
  const validateField = (name, value) => {
    let error = ""
    
    if (!value) error = "Requis"
    else if (isNaN(Number(value))) error = "Nombre invalide"
    else if (name.includes("Lat") && (value < -90 || value > 90)) 
      error = "Entre -90 et 90"
    else if (name.includes("Lon") && (value < -180 || value > 180)) 
      error = "Entre -180 et 180"
    else if (name.includes("Zoom") && (value < 0 || value > 20)) 
      error = "Entre 0 et 20"
    
    setErrors(prev => ({ ...prev, [name]: error }))
    return !error
  }

  // Mettre à jour les valeurs avec validation
  const handleInputChange = (name, value) => {
    setCustomRegion(prev => ({ ...prev, [name]: value }))
    
    if (value) {
      validateField(name, value)
    }
  }

  // Précharger une région
  const handlePreloadRegion = async (region, name) => {
    try {
      const online = await isOnline()
      if (!online) {
        Alert.alert("Mode hors ligne", "Vous devez être en ligne pour précharger des tuiles.")
        return
      }

      setPreloading(true)
      setPreloadProgress({ 
        name, 
        count: 0, 
        total: 0,
        percent: 0 
      })

      // Animation de la barre de progression
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: false
      }).start()

      // Appel corrigé avec 4 paramètres
      const result = await preloadRegion(
        region, 
        Number.parseInt(region.minZoom), 
        Number.parseInt(region.maxZoom),
        (count, total) => {
          const percent = total > 0 ? Math.round((count / total) * 100) : 0
          setPreloadProgress({ 
            name, 
            count, 
            total,
            percent 
          })
          
          // Mettre à jour l'animation
          Animated.timing(progressAnim, {
            toValue: percent / 100,
            duration: 300,
            easing: Easing.ease,
            useNativeDriver: false
          }).start()
        }
      )

      setPreloading(false)
      setPreloadProgress(null)

      if (result.success) {
        Alert.alert("Préchargement terminé", `${result.count} tuiles téléchargées pour "${name}".`)
      } else {
        Alert.alert("Erreur", result.message || "Échec du préchargement")
      }
    } catch (error) {
      console.error("Erreur de préchargement:", error)
      setPreloading(false)
      setPreloadProgress(null)
      Alert.alert("Erreur", "Échec du préchargement")
    }
  }

  // Précharger une région personnalisée
  const handlePreloadCustomRegion = async () => {
    // Valider tous les champs
    const isValid = Object.keys(customRegion).every(key => 
      validateField(key, customRegion[key])
    )

    if (!isValid) {
      Alert.alert("Erreur", "Veuillez corriger les erreurs dans le formulaire")
      return
    }

    const region = {
      minLat: parseFloat(customRegion.minLat),
      maxLat: parseFloat(customRegion.maxLat),
      minLon: parseFloat(customRegion.minLon),
      maxLon: parseFloat(customRegion.maxLon),
      minZoom: parseInt(customRegion.minZoom),
      maxZoom: parseInt(customRegion.maxZoom),
    }

    // Vérifier les plages valides
    if (region.minLat >= region.maxLat) {
      setErrors(prev => ({
        ...prev,
        minLat: "Doit être < max",
        maxLat: "Doit être > min"
      }))
      return
    }

    if (region.minLon >= region.maxLon) {
      setErrors(prev => ({
        ...prev,
        minLon: "Doit être < max",
        maxLon: "Doit être > min"
      }))
      return
    }

    if (region.minZoom > region.maxZoom) {
      setErrors(prev => ({
        ...prev,
        minZoom: "Doit être ≤ max",
        maxZoom: "Doit être ≥ min"
      }))
      return
    }

    if (region.maxZoom - region.minZoom > 5) {
      Alert.alert(
        "Avertissement",
        "La plage de zoom est large (plus de 5 niveaux). Cela peut prendre du temps et utiliser beaucoup de données. Continuer ?",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Continuer", onPress: () => handlePreloadRegion(region, "Région personnalisée") },
        ]
      )
      return
    }

    handlePreloadRegion(region, "Région personnalisée")
  }

  // Vider le cache
  const handleClearCache = async () => {
    Alert.alert("Vider le cache", "Supprimer toutes les tuiles mises en cache ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Vider",
        style: "destructive",
        onPress: async () => {
          setLoading(true)
          try {
            const result = await clearCache()
            if (result) {
              Alert.alert("Succès", "Cache vidé avec succès")
            } else {
              Alert.alert("Erreur", "Échec de la suppression du cache")
            }
          } catch (error) {
            console.error("Erreur de suppression:", error)
            Alert.alert("Erreur", "Échec de la suppression")
          } finally {
            setLoading(false)
          }
        },
      },
    ])
  }

  // Barre de progression animée
  const interpolatedProgress = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"]
  })

  return (
    <View style={styles.container}>
      <NetworkStatus />
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Gestion du cache des cartes</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Statistiques du cache */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistiques du cache</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Tuiles en cache</Text>
              <Text style={styles.statValue}>
                {cacheStats.tileCount?.toLocaleString() || "0"}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Taille totale</Text>
              <Text style={styles.statValue}>
                {cacheStats.totalSizeMB?.toFixed(2) || "0.00"} MB
              </Text>
            </View>
          </View>
        </View>

        {/* Préchargement de régions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Précharger une région</Text>
          <Text style={styles.sectionDescription}>
            Téléchargez les tuiles pour une région spécifique afin de les consulter hors ligne.
          </Text>

          {isOfflineMode && (
            <View style={styles.offlineWarning}>
              <Ionicons name="cloud-offline" size={20} color="#FFC107" />
              <Text style={styles.offlineWarningText}>
                Préchargement indisponible hors ligne
              </Text>
            </View>
          )}

          {/* Région prédéfinie: Montpellier */}
          <TouchableOpacity
            style={[
              styles.preloadButton, 
              (isOfflineMode || preloading) && styles.disabledButton
            ]}
            onPress={() => handlePreloadRegion(
              {
                minLat: 43.5,
                maxLat: 43.7,
                minLon: 3.8,
                maxLon: 4.0,
                minZoom: 12,
                maxZoom: 16,
              },
              "Montpellier"
            )}
            disabled={isOfflineMode || preloading}
          >
            <Ionicons name="download-outline" size={20} color="#FFFFFF" />
            <Text style={styles.preloadButtonText}>Montpellier</Text>
          </TouchableOpacity>

          {/* Région prédéfinie: Nîmes */}
          <TouchableOpacity
            style={[
              styles.preloadButton, 
              (isOfflineMode || preloading) && styles.disabledButton
            ]}
            onPress={() => handlePreloadRegion(
              {
                minLat: 43.8,
                maxLat: 44.0,
                minLon: 4.3,
                maxLon: 4.5,
                minZoom: 12,
                maxZoom: 16,
              },
              "Nîmes"
            )}
            disabled={isOfflineMode || preloading}
          >
            <Ionicons name="download-outline" size={20} color="#FFFFFF" />
            <Text style={styles.preloadButtonText}>Nîmes</Text>
          </TouchableOpacity>

          {/* Région personnalisée */}
          <View style={styles.customRegionContainer}>
            <Text style={styles.customRegionTitle}>Région personnalisée</Text>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Latitude min</Text>
                <TextInput
                  style={[
                    styles.input, 
                    errors.minLat && styles.inputError
                  ]}
                  value={customRegion.minLat}
                  onChangeText={(text) => handleInputChange("minLat", text)}
                  onBlur={() => validateField("minLat", customRegion.minLat)}
                  keyboardType="numeric"
                  placeholder="43.5"
                  placeholderTextColor="#999"
                />
                {errors.minLat && (
                  <Text style={styles.errorText}>{errors.minLat}</Text>
                )}
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Latitude max</Text>
                <TextInput
                  style={[
                    styles.input, 
                    errors.maxLat && styles.inputError
                  ]}
                  value={customRegion.maxLat}
                  onChangeText={(text) => handleInputChange("maxLat", text)}
                  onBlur={() => validateField("maxLat", customRegion.maxLat)}
                  keyboardType="numeric"
                  placeholder="43.7"
                  placeholderTextColor="#999"
                />
                {errors.maxLat && (
                  <Text style={styles.errorText}>{errors.maxLat}</Text>
                )}
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Longitude min</Text>
                <TextInput
                  style={[
                    styles.input, 
                    errors.minLon && styles.inputError
                  ]}
                  value={customRegion.minLon}
                  onChangeText={(text) => handleInputChange("minLon", text)}
                  onBlur={() => validateField("minLon", customRegion.minLon)}
                  keyboardType="numeric"
                  placeholder="3.8"
                  placeholderTextColor="#999"
                />
                {errors.minLon && (
                  <Text style={styles.errorText}>{errors.minLon}</Text>
                )}
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Longitude max</Text>
                <TextInput
                  style={[
                    styles.input, 
                    errors.maxLon && styles.inputError
                  ]}
                  value={customRegion.maxLon}
                  onChangeText={(text) => handleInputChange("maxLon", text)}
                  onBlur={() => validateField("maxLon", customRegion.maxLon)}
                  keyboardType="numeric"
                  placeholder="4.0"
                  placeholderTextColor="#999"
                />
                {errors.maxLon && (
                  <Text style={styles.errorText}>{errors.maxLon}</Text>
                )}
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Zoom min</Text>
                <TextInput
                  style={[
                    styles.input, 
                    errors.minZoom && styles.inputError
                  ]}
                  value={customRegion.minZoom}
                  onChangeText={(text) => handleInputChange("minZoom", text)}
                  onBlur={() => validateField("minZoom", customRegion.minZoom)}
                  keyboardType="numeric"
                  placeholder="12"
                  placeholderTextColor="#999"
                />
                {errors.minZoom && (
                  <Text style={styles.errorText}>{errors.minZoom}</Text>
                )}
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Zoom max</Text>
                <TextInput
                  style={[
                    styles.input, 
                    errors.maxZoom && styles.inputError
                  ]}
                  value={customRegion.maxZoom}
                  onChangeText={(text) => handleInputChange("maxZoom", text)}
                  onBlur={() => validateField("maxZoom", customRegion.maxZoom)}
                  keyboardType="numeric"
                  placeholder="16"
                  placeholderTextColor="#999"
                />
                {errors.maxZoom && (
                  <Text style={styles.errorText}>{errors.maxZoom}</Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.preloadButton, 
                (isOfflineMode || preloading || Object.values(errors).some(e => e)) && 
                styles.disabledButton
              ]}
              onPress={handlePreloadCustomRegion}
              disabled={isOfflineMode || preloading || Object.values(errors).some(e => e)}
            >
              <Ionicons name="download-outline" size={20} color="#FFFFFF" />
              <Text style={styles.preloadButtonText}>Précharger la région</Text>
            </TouchableOpacity>
          </View>

          {/* Indicateur de progression */}
          {preloading && preloadProgress && (
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <ActivityIndicator size="small" color="#00C853" />
                <Text style={styles.progressText}>
                  Préchargement "{preloadProgress.name}"...
                </Text>
              </View>
              
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[
                    styles.progressFill, 
                    { width: interpolatedProgress }
                  ]} 
                />
              </View>
              
              <Text style={styles.progressCount}>
                {preloadProgress.count} / {preloadProgress.total} tuiles • 
                {preloadProgress.percent}%
              </Text>
            </View>
          )}
        </View>

        {/* Gestion du cache */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gestion du cache</Text>
          <TouchableOpacity
            style={[styles.clearButton, loading && styles.disabledButton]}
            onPress={handleClearCache}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
                <Text style={styles.clearButtonText}>Vider le cache</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.warningText}>
            Attention: Supprime toutes les tuiles mises en cache.
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#c1dbb0",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingBottom: 10,
    backgroundColor: "#3a7d44",
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    flex: 1,
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
    paddingTop: 10,
  },
  section: {
    padding: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    margin: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 14,
    color: "#e0e0e0",
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 8,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 14,
    color: "#e0e0e0",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  preloadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2e7d32",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  preloadButtonText: {
    color: "#FFFFFF",
    marginLeft: 8,
    fontWeight: "500",
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#c62828",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  clearButtonText: {
    color: "#FFFFFF",
    marginLeft: 8,
    fontWeight: "500",
  },
  disabledButton: {
    opacity: 0.6,
  },
  warningText: {
    fontSize: 12,
    color: "#ffcdd2",
    textAlign: "center",
  },
  customRegionContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  customRegionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
  },
  inputRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  inputGroup: {
    flex: 1,
    marginRight: 8,
  },
  inputLabel: {
    fontSize: 14,
    color: "#e0e0e0",
    marginBottom: 4,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 4,
    padding: 10,
    color: "#FFFFFF",
    fontSize: 15,
  },
  inputError: {
    borderWidth: 1,
    borderColor: "#ff5252",
  },
  errorText: {
    fontSize: 12,
    color: "#ff5252",
    marginTop: 4,
  },
  progressContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  progressText: {
    color: "#FFFFFF",
    marginLeft: 8,
    fontSize: 14,
  },
  progressBar: {
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 3,
    overflow: "hidden",
    marginVertical: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#00C853",
  },
  progressCount: {
    fontSize: 12,
    color: "#e0e0e0",
    textAlign: "center",
    marginTop: 4,
  },
  offlineWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 193, 7, 0.2)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  offlineWarningText: {
    color: "#FFC107",
    marginLeft: 8,
    fontSize: 14,
  },
})

export default MapCacheScreen