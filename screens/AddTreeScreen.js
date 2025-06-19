"use client"

import { Ionicons } from "@expo/vector-icons"
import { Picker } from "@react-native-picker/picker"
import * as ImagePicker from "expo-image-picker"
import * as Location from "expo-location"
import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import MapComponent from "../components/MapComponent"
import { useMapTiles } from "../components/MapTileProvider"
import NetworkStatus from "../components/NetworkStatus"
import api from "../services/api"
import * as AuthService from "../services/auth"
import { isOnline } from "../services/network"
import AsyncStorage from "@react-native-async-storage/async-storage"

// Clés de stockage local
const LOCAL_TREES_KEY = "@local_trees"
const SYNC_QUEUE_KEY = "@sync_queue"

const AddTreeScreen = ({ route, navigation }) => {
  const { projectId, initialLocation } = route.params || {}

  // États pour les champs du formulaire
  const [name, setName] = useState("")
  const [species, setSpecies] = useState("")
  const [description, setDescription] = useState("")
  const [height, setHeight] = useState("")
  const [diameter, setDiameter] = useState("")
  const [health, setHealth] = useState("good")
  const [images, setImages] = useState([])
  const [location, setLocation] = useState(initialLocation || null)
  const [locationName, setLocationName] = useState("")
  const [loading, setLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(!initialLocation)
  const [mapRegion, setMapRegion] = useState(null)
  const [mapMarkers, setMapMarkers] = useState([])
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const { preloadRegion } = useMapTiles()
  const [isNetworkAvailable, setIsNetworkAvailable] = useState(true)
  const [mapType, setMapType] = useState("standard") // "standard" ou "satellite"

  // Vérification du projectId
  if (!projectId) {
    Alert.alert("Erreur", "ID du projet manquant")
    navigation.goBack()
    return null
  }

  // Effet pour obtenir la position actuelle si aucune position initiale n'est fournie
  useEffect(() => {
    if (!initialLocation) {
      getCurrentLocation()
    } else {
      // Initialiser la région de la carte avec la position initiale
      setMapRegion({
        latitude: initialLocation.latitude,
        longitude: initialLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      })

      // Initialiser le marqueur avec la position initiale
      updateMapMarker(initialLocation)
    }

    // Vérifier l'état de la connexion
    checkConnectionStatus()

    // Configurer un intervalle pour vérifier l'état de la connexion
    const connectionInterval = setInterval(checkConnectionStatus, 10000)

    return () => clearInterval(connectionInterval)
  }, [initialLocation])

  // Vérifier l'état de la connexion
  const checkConnectionStatus = async () => {
    try {
      const online = await isOnline()
      setIsOfflineMode(!online)
      setIsNetworkAvailable(online)
    } catch (error) {
      setIsOfflineMode(true)
      setIsNetworkAvailable(false)
    }
  }

  // Mettre à jour le marqueur sur la carte
  const updateMapMarker = (position) => {
    if (!position) return

    setMapMarkers([
      {
        latitude: position.latitude,
        longitude: position.longitude,
        title: "Emplacement de l'arbre",
      },
    ])
  }

  // Fonction pour obtenir la position actuelle
  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true)
      const { status } = await Location.requestForegroundPermissionsAsync()

      if (status !== "granted") {
        Alert.alert("Permission refusée", "Nous avons besoin de votre permission pour accéder à votre position.")
        setLocationLoading(false)
        return
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })

      const newLocation = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      }

      setLocation(newLocation)

      // Définir la région de la carte
      setMapRegion({
        latitude: newLocation.latitude,
        longitude: newLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      })

      // Mettre à jour le marqueur
      updateMapMarker(newLocation)

      setLocationLoading(false)
    } catch (error) {
      // Définir une position par défaut en cas d'erreur
      const defaultRegion = {
        latitude: 43.6,
        longitude: 3.9,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
      setMapRegion(defaultRegion)
      setLocationLoading(false)
    }
  }

  // Fonction pour mettre à jour la position sur la carte
  const handleMapPress = (event) => {
    const { coordinate } = event.nativeEvent
    setLocation(coordinate)
    updateMapMarker(coordinate)
  }

  // Fonction pour ajouter une image
  const addImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (status !== "granted") {
        Alert.alert("Permission refusée", "Nous avons besoin de votre permission pour accéder à votre galerie.")
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const base64Size = result.assets[0].base64.length * 0.75
        const maxSize = 2 * 1024 * 1024 // 2MB

        if (base64Size > maxSize) {
          Alert.alert(
            "Image trop volumineuse",
            "L'image sélectionnée est trop grande. Veuillez choisir une image plus petite.",
          )
          return
        }

        const newImage = `data:image/jpeg;base64,${result.assets[0].base64}`
        setImages([...images, newImage])
      }
    } catch (error) {
      Alert.alert("Erreur", "Impossible de sélectionner l'image")
    }
  }

  // Fonction pour prendre une photo
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()

      if (status !== "granted") {
        Alert.alert("Permission refusée", "Nous avons besoin de votre permission pour accéder à votre appareil photo.")
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const base64Size = result.assets[0].base64.length * 0.75
        const maxSize = 2 * 1024 * 1024 // 2MB

        if (base64Size > maxSize) {
          Alert.alert("Image trop volumineuse", "L'image prise est trop grande. Veuillez réduire la qualité.")
          return
        }

        const newImage = `data:image/jpeg;base64,${result.assets[0].base64}`
        setImages([...images, newImage])
      }
    } catch (error) {
      Alert.alert("Erreur", "Impossible de prendre une photo")
    }
  }

  // Fonction pour supprimer une image
  const removeImage = (index) => {
    const updatedImages = [...images]
    updatedImages.splice(index, 1)
    setImages(updatedImages)
  }

  // Fonction pour précharger les tuiles de carte pour cette région
  const handlePreloadMapTiles = async () => {
    if (!mapRegion) return

    try {
      // Définir la région à précharger (légèrement plus grande que la région visible)
      const region = {
        minLat: mapRegion.latitude - mapRegion.latitudeDelta * 2,
        maxLat: mapRegion.latitude + mapRegion.latitudeDelta * 2,
        minLon: mapRegion.longitude - mapRegion.longitudeDelta * 2,
        maxLon: mapRegion.longitude + mapRegion.longitudeDelta * 2,
        minZoom: 12,
        maxZoom: 16,
      }

      // Demander confirmation à l'utilisateur
      Alert.alert(
        "Précharger les tuiles de carte",
        "Voulez-vous précharger les tuiles de carte pour cette région ? Cela permettra de consulter la carte hors ligne.",
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Précharger",
            onPress: async () => {
              // Vérifier si nous sommes en ligne
              const online = await isOnline()
              if (!online) {
                Alert.alert("Mode hors ligne", "Vous devez être en ligne pour précharger les tuiles de carte.")
                return
              }

              // Afficher un indicateur de chargement
              setLoading(true)

              // Précharger les tuiles
              const result = await preloadRegion(region)
              setLoading(false)

              if (result.success) {
                Alert.alert("Préchargement terminé", `${result.count} tuiles ont été téléchargées pour cette région.`)
              } else {
                Alert.alert("Erreur", `Le préchargement a échoué: ${result.message || "Erreur inconnue"}`)
              }
            },
          },
        ],
      )
    } catch (error) {
      Alert.alert("Erreur", "Une erreur s'est produite lors du préchargement des tuiles.")
    }
  }

  // Fonction pour sauvegarder un arbre localement
  const saveTreeLocally = async (treeData) => {
    try {
      // Récupérer les arbres existants
      const localTreesString = await AsyncStorage.getItem(LOCAL_TREES_KEY)
      const localTrees = localTreesString ? JSON.parse(localTreesString) : []

      // Ajouter le nouvel arbre
      localTrees.push(treeData)

      // Sauvegarder la liste mise à jour
      await AsyncStorage.setItem(LOCAL_TREES_KEY, JSON.stringify(localTrees))

      // Ajouter à la file d'attente de synchronisation
      const syncQueueString = await AsyncStorage.getItem(SYNC_QUEUE_KEY)
      const syncQueue = syncQueueString ? JSON.parse(syncQueueString) : []

      syncQueue.push({
        type: "tree",
        action: "create",
        data: treeData,
        projectId: projectId,
        timestamp: Date.now(),
      })

      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(syncQueue))

      return true
    } catch (error) {
      throw new Error("Impossible de sauvegarder l'arbre localement")
    }
  }

  // Fonction pour soumettre le formulaire
  const handleSubmit = async () => {
    try {
      if (!name.trim()) {
        Alert.alert("Erreur", "Veuillez entrer un nom pour l'arbre")
        return
      }

      if (!location) {
        Alert.alert("Erreur", "Veuillez sélectionner un emplacement sur la carte")
        return
      }

      setLoading(true)

      // Récupérer les informations de l'utilisateur actuel
      let userId = null
      let userName = "Utilisateur"
      try {
        const currentUser = await AuthService.getCurrentUser()
        if (currentUser) {
          userId = currentUser._id || currentUser.id
          userName = currentUser.name || "Utilisateur"
        }
      } catch (userError) {
        console.error("Erreur lors de la récupération des informations utilisateur:", userError)
      }

      // Préparer les données à envoyer
      const treeData = {
        name,
        species: species || null,
        description: description || null,
        height: height ? Number.parseFloat(height) : null,
        diameter: diameter ? Number.parseFloat(diameter) : null,
        health,
        images,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          name: locationName || null,
        },
        projectId,
        addedBy: userId,
        addedByUser: {
          _id: userId,
          name: userName,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // ID temporaire pour le mode hors ligne
        _id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        // Indicateur pour savoir que c'est un arbre local
        isLocalOnly: !isNetworkAvailable,
      }

      // Vérifier si nous sommes en ligne
      if (isNetworkAvailable) {
        try {
          // Envoyer les données à l'API
          await api.post("/trees", treeData)

          Alert.alert("Succès", "L'arbre a été ajouté avec succès", [
            {
              text: "OK",
              onPress: () => {
                navigation.goBack()
              },
            },
          ])
        } catch (apiError) {
          // Sauvegarder localement en cas d'erreur API
          await saveTreeLocally(treeData)

          Alert.alert(
            "Erreur de connexion",
            "Impossible d'ajouter l'arbre en ligne. L'arbre a été sauvegardé localement et sera synchronisé ultérieurement.",
            [
              {
                text: "OK",
                onPress: () => {
                  navigation.goBack()
                },
              },
            ],
          )
        }
      } else {
        // Mode hors ligne : sauvegarder localement
        await saveTreeLocally(treeData)

        Alert.alert(
          "Arbre sauvegardé localement",
          "L'arbre a été ajouté en mode hors ligne. Il sera synchronisé avec le serveur lorsque vous serez connecté à Internet.",
          [
            {
              text: "OK",
              onPress: () => {
                navigation.goBack()
              },
            },
          ],
        )
      }
    } catch (error) {
      Alert.alert("Erreur", "Impossible d'ajouter l'arbre")
    } finally {
      setLoading(false)
    }
  }

  // Fonction pour basculer entre les types de carte
  const toggleMapType = () => {
    setMapType(prevType => prevType === "standard" ? "satellite" : "standard")
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <NetworkStatus />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Ajouter un arbre</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Informations de base</Text>

          {/* Nom de l'arbre */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Nom de l'arbre *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Entrez un nom"
              placeholderTextColor="#999"
            />
          </View>

          {/* Espèce */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Espèce</Text>
            <TextInput
              style={styles.input}
              value={species}
              onChangeText={setSpecies}
              placeholder="Entrez l'espèce"
              placeholderTextColor="#999"
            />
          </View>

          {/* Description */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Entrez une description"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Caractéristiques</Text>

          {/* Hauteur */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Hauteur (m)</Text>
            <TextInput
              style={styles.input}
              value={height}
              onChangeText={setHeight}
              placeholder="Entrez la hauteur"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
          </View>

          {/* Diamètre */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Diamètre (cm)</Text>
            <TextInput
              style={styles.input}
              value={diameter}
              onChangeText={setDiameter}
              placeholder="Entrez le diamètre"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
          </View>

          {/* État de santé */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>État de santé</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={health}
                onValueChange={(itemValue) => setHealth(itemValue)}
                style={styles.picker}
                dropdownIconColor="#FFFFFF"
              >
                <Picker.Item label="Bon" value="good" color="#0C0F0A" />
                <Picker.Item label="Moyen" value="fair" color="#0C0F0A" />
                <Picker.Item label="Mauvais" value="poor" color="#0C0F0A" />
                <Picker.Item label="Critique" value="critical" color="#0C0F0A" />
                <Picker.Item label="Mort" value="dead" color="#0C0F0A" />
                <Picker.Item label="Inconnu" value="unknown" color="#0C0F0A" />
              </Picker>
            </View>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Photos</Text>

          <View style={styles.photoButtons}>
            <TouchableOpacity style={styles.photoButton} onPress={addImage}>
              <Ionicons name="images" size={24} color="#FFFFFF" />
              <Text style={styles.photoButtonText}>Galerie</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
              <Ionicons name="camera" size={24} color="#FFFFFF" />
              <Text style={styles.photoButtonText}>Appareil photo</Text>
            </TouchableOpacity>
          </View>

          {images.length > 0 && (
            <View style={styles.imagePreviewContainer}>
              {images.map((image, index) => (
                <View key={index} style={styles.imagePreview}>
                  <Image source={{ uri: image }} style={styles.previewImage} />
                  <TouchableOpacity style={styles.removeImageButton} onPress={() => removeImage(index)}>
                    <Ionicons name="close-circle" size={24} color="#FF5252" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Localisation</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Nom de l'emplacement (optionnel)</Text>
            <TextInput
              style={styles.input}
              value={locationName}
              onChangeText={setLocationName}
              placeholder="Entrez un nom pour cet emplacement"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.mapHeader}>
            <Text style={styles.mapInstructions}>Appuyez sur la carte pour définir l'emplacement de l'arbre</Text>
            <View style={styles.mapButtonsContainer}>
              <TouchableOpacity style={styles.preloadButton} onPress={handlePreloadMapTiles}>
                <Ionicons name="download-outline" size={16} color="#FFFFFF" />
                <Text style={styles.preloadButtonText}>Précharger</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mapTypeButton} onPress={toggleMapType}>
                <Ionicons name={mapType === "satellite" ? "map" : "earth"} size={16} color="#FFFFFF" />
                <Text style={styles.mapTypeButtonText}>
                  {mapType === "satellite" ? "Carte" : "Satellite"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {locationLoading ? (
            <View style={styles.mapLoadingContainer}>
              <ActivityIndicator size="large" color="#00C853" />
              <Text style={styles.loadingText}>Chargement de la carte...</Text>
            </View>
          ) : (
            <View style={styles.mapContainer}>
              {mapRegion && (
                <MapComponent
                  initialRegion={mapRegion}
                  markers={mapMarkers}
                  onPress={handleMapPress}
                  zoomEnabled={true}
                  scrollEnabled={true}
                  style={styles.map}
                  mapType={mapType} // Passer le type de carte
                />
              )}

              <TouchableOpacity style={styles.currentLocationButton} onPress={getCurrentLocation}>
                <Ionicons name="locate" size={24} color="#FFFFFF" />
              </TouchableOpacity>

              {isOfflineMode && (
                <View style={styles.offlineMapBanner}>
                  <Ionicons name="cloud-offline" size={14} color="#000" />
                  <Text style={styles.offlineMapText}>Mode hors ligne - Carte limitée aux tuiles préchargées</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="save" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>
                {isOfflineMode ? "Ajouter l'arbre (hors ligne)" : "Ajouter l'arbre"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  },
  formSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: "#999999",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#96c06e",
    borderRadius: 8,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  pickerContainer: {
    backgroundColor: "#96c06e",
    borderRadius: 8,
    overflow: "hidden",
  },
  picker: {
    color: "#0C0F0A",
    backgroundColor: "#96c06e",
    height: 50,
  },
  photoButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  photoButton: {
    backgroundColor: "#6ca81f",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "45%",
  },
  photoButtonText: {
    color: "#FFFFFF",
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "500",
  },
  imagePreviewContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  imagePreview: {
    width: "48%",
    aspectRatio: 1,
    marginBottom: 10,
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  removeImageButton: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 12,
  },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  mapInstructions: {
    color: "#CCCCCC",
    fontSize: 14,
    fontStyle: "italic",
    flex: 1,
  },
  mapButtonsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  preloadButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  preloadButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    marginLeft: 4,
  },
  mapTypeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  mapTypeButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    marginLeft: 4,
  },
  mapLoadingContainer: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#333",
    borderRadius: 8,
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 10,
  },
  mapContainer: {
    height: 300,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  currentLocationButton: {
    position: "absolute",
    right: 10,
    bottom: 10,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  offlineMapBanner: {
    position: "absolute",
    bottom: 60,
    left: 10,
    right: 10,
    backgroundColor: "rgba(255, 193, 7, 0.8)",
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  offlineMapText: {
    color: "#000000",
    fontSize: 12,
    marginLeft: 4,
    fontWeight: "bold",
  },
  submitButton: {
    backgroundColor: "#6ca81f",
    borderRadius: 8,
    padding: 16,
    margin: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
})

export default AddTreeScreen