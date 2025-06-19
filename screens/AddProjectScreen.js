"use client"

import { Ionicons } from "@expo/vector-icons"
import * as Location from "expo-location"
import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import NetworkStatus from "../components/NetworkStatus"
import api from "../services/api"
import { isOnline } from "../services/network"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useMapTiles } from "../components/MapTileProvider"

// Clé pour le stockage local des projets
const LOCAL_PROJECTS_KEY = "@local_projects"
const SYNC_QUEUE_KEY = "@sync_queue"

const AddProjectScreen = ({ navigation }) => {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState({
    latitude: 0,
    longitude: 0,
    name: "",
  })
  const [mapRegion, setMapRegion] = useState(null)
  const [loading, setLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [selectedMembers, setSelectedMembers] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [isNetworkAvailable, setIsNetworkAvailable] = useState(true)
  const [mapMarkers, setMapMarkers] = useState([])
  const { preloadRegion } = useMapTiles()

  // Vérifier l'état du réseau au chargement
  useEffect(() => {
    const checkNetwork = async () => {
      const online = await isOnline()
      setIsNetworkAvailable(online)
    }

    checkNetwork()

    // Vérifier périodiquement l'état du réseau
    const networkInterval = setInterval(checkNetwork, 10000)

    return () => clearInterval(networkInterval)
  }, [])

  // Obtenir la position actuelle lors du chargement de l'écran
  useEffect(() => {
    getCurrentLocation()
  }, [])

  // Mettre à jour les marqueurs lorsque la localisation change
  useEffect(() => {
    if (location.latitude && location.longitude) {
      setMapMarkers([
        {
          latitude: location.latitude,
          longitude: location.longitude,
          title: location.name || "Position sélectionnée",
        },
      ])
    }
  }, [location])

  // Rechercher des utilisateurs lorsque la requête change
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length >= 3 && isNetworkAvailable) {
        setSearchLoading(true)
        try {
          const results = await api.get(`/users/search?query=${searchQuery}`)
          setSearchResults(results)
        } catch (error) {
          console.error("Erreur lors de la recherche d'utilisateurs:", error)
        } finally {
          setSearchLoading(false)
        }
      } else {
        setSearchResults([])
      }
    }

    // Utiliser un délai pour éviter trop de requêtes pendant la saisie
    const timeoutId = setTimeout(() => {
      searchUsers()
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, isNetworkAvailable])

  // Fonction pour obtenir la position actuelle
  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true)
      const { status } = await Location.requestForegroundPermissionsAsync()

      if (status !== "granted") {
        setError("Permission de localisation refusée")
        setLocationLoading(false)
        return
      }

      const currentLocation = await Location.getCurrentPositionAsync({})
      const region = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }

      setMapRegion(region)
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        name: "Position actuelle",
      })
      setLocationLoading(false)
    } catch (error) {
      console.error("Erreur lors de l'obtention de la position:", error)
      setError("Impossible d'obtenir votre position")
      setLocationLoading(false)

      // Définir une position par défaut en cas d'erreur
      const defaultRegion = {
        latitude: 43.6,
        longitude: 3.9,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }
      setMapRegion(defaultRegion)
    }
  }

  // Fonction pour mettre à jour la position sur la carte
  const handleMapPress = (event) => {
    const { coordinate } = event.nativeEvent
    setLocation({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      name: location.name || "Position sélectionnée",
    })
  }

  // Fonction pour ajouter un membre à la liste
  const handleAddMember = (user) => {
    // Vérifier si l'utilisateur est déjà dans la liste
    if (!selectedMembers.some((member) => member._id === user._id)) {
      setSelectedMembers([...selectedMembers, user])
    }
    setSearchQuery("")
    setSearchResults([])
  }

  // Fonction pour supprimer un membre de la liste
  const handleRemoveMember = (userId) => {
    setSelectedMembers(selectedMembers.filter((member) => member._id !== userId))
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
      console.error("Erreur lors du préchargement des tuiles:", error)
      Alert.alert("Erreur", "Une erreur s'est produite lors du préchargement des tuiles.")
    }
  }

  // Fonction pour créer un nouveau projet
  const handleCreateProject = async () => {
    try {
      // Validation des champs
      if (!name.trim()) {
        setError("Le nom du projet est requis")
        return
      }

      setLoading(true)
      setError("")

      // Préparer les données du projet
      const projectData = {
        name,
        description,
        location: {
          lat: location.latitude,
          lng: location.longitude,
          name: location.name,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        members: selectedMembers.map((member) => ({
          _id: member._id,
          name: member.name,
          email: member.email,
          role: "member",
          status: "active",
        })),
        // ID temporaire pour le mode hors ligne
        _id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        // Indicateur pour savoir que c'est un projet local
        isLocalOnly: !isNetworkAvailable,
      }

      console.log("Envoi des données du projet :", projectData)

      // Vérifier si nous sommes en ligne
      if (isNetworkAvailable) {
        try {
          // Appel à l'API pour créer le projet
          const newProject = await api.post("/projects", projectData)
          console.log("Réponse de l'API /projects :", newProject)

          // Vérifier que le projet a bien été créé
          if (!newProject || !newProject._id) {
            throw new Error("Erreur inattendue : identifiant du projet manquant")
          }

          // Ajout des membres (si sélectionnés)
          if (selectedMembers.length > 0) {
            for (const member of selectedMembers) {
              try {
                console.log(`Ajout du membre ${member.name} (${member._id}) au projet ${newProject._id}`)
                await api.post(`/projects/${newProject._id}/members`, { memberId: member._id })
              } catch (memberError) {
                console.error(`Erreur lors de l'ajout du membre ${member.name} :`, memberError)
                // Continuer malgré l'erreur
              }
            }
          }

          // Succès
          Alert.alert("Succès", "Le projet a été créé avec succès", [
            {
              text: "OK",
              onPress: () => navigation.navigate("Home"),
            },
          ])
        } catch (apiError) {
          console.error("Erreur API lors de la création du projet :", apiError)

          // Sauvegarder localement en cas d'erreur API
          await saveProjectLocally(projectData)

          Alert.alert(
            "Erreur de connexion",
            "Impossible de créer le projet en ligne. Le projet a été sauvegardé localement et sera synchronisé ultérieurement.",
            [
              {
                text: "OK",
                onPress: () => navigation.navigate("Home"),
              },
            ],
          )
        }
      } else {
        // Mode hors ligne : sauvegarder localement
        await saveProjectLocally(projectData)

        Alert.alert(
          "Projet sauvegardé localement",
          "Le projet a été créé en mode hors ligne. Il sera synchronisé avec le serveur lorsque vous serez connecté à Internet.",
          [
            {
              text: "OK",
              onPress: () => navigation.navigate("Home"),
            },
          ],
        )
      }
    } catch (error) {
      console.error("Erreur lors de la création du projet :", error)
      setError(error.message || "Erreur lors de la création du projet")
    } finally {
      setLoading(false)
    }
  }

  // Fonction pour sauvegarder le projet localement
  const saveProjectLocally = async (projectData) => {
    try {
      // Récupérer les projets existants
      const localProjectsString = await AsyncStorage.getItem(LOCAL_PROJECTS_KEY)
      const localProjects = localProjectsString ? JSON.parse(localProjectsString) : []

      // Ajouter le nouveau projet
      localProjects.push(projectData)

      // Sauvegarder la liste mise à jour
      await AsyncStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(localProjects))

      // Ajouter à la file d'attente de synchronisation
      const syncQueueString = await AsyncStorage.getItem(SYNC_QUEUE_KEY)
      const syncQueue = syncQueueString ? JSON.parse(syncQueueString) : []

      syncQueue.push({
        type: "project",
        action: "create",
        data: projectData,
        timestamp: Date.now(),
      })

      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(syncQueue))

      console.log("Projet sauvegardé localement avec succès")
      return true
    } catch (error) {
      console.error("Erreur lors de la sauvegarde locale du projet:", error)
      throw new Error("Impossible de sauvegarder le projet localement")
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <NetworkStatus />
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Nouveau Projet</Text>
          <View style={{ width: 24 }} />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.formContainer}>
          <Text style={styles.label}>Nom du projet</Text>
          <TextInput
            style={styles.input}
            placeholder="Entrez le nom du projet"
            placeholderTextColor="#999"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Entrez une description du projet"
            placeholderTextColor="#999"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Text style={styles.label}>Localisation</Text>
          <TextInput
            style={styles.input}
            placeholder="Nom de la localisation"
            placeholderTextColor="#999"
            value={location.name}
            onChangeText={(text) => setLocation({ ...location, name: text })}
          />

          <View style={styles.mapContainer}>
            {locationLoading ? (
              <View style={styles.mapLoading}>
                <ActivityIndicator size="large" color="#00C853" />
                <Text style={styles.loadingText}>Chargement de la carte...</Text>
              </View>
            ) : mapRegion ? (
              <MapComponent
                initialRegion={mapRegion}
                onPress={handleMapPress}
                markers={mapMarkers}
                zoomEnabled={true}
                scrollEnabled={true}
                rotateEnabled={false}
              />
            ) : (
              <View style={styles.mapError}>
                <Text style={styles.errorText}>Impossible de charger la carte</Text>
              </View>
            )}
          </View>

          <View style={styles.mapActions}>
            <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation}>
              <Ionicons name="locate" size={20} color="#FFFFFF" />
              <Text style={styles.locationButtonText}>Utiliser ma position actuelle</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.preloadButton} onPress={handlePreloadMapTiles}>
              <Ionicons name="download-outline" size={16} color="#FFFFFF" />
              <Text style={styles.preloadButtonText}>Précharger la carte</Text>
            </TouchableOpacity>
          </View>

          {isNetworkAvailable ? (
            <>
              <Text style={styles.label}>Ajouter des membres</Text>
              <TextInput
                style={styles.input}
                placeholder="Rechercher par nom ou email"
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />

              {searchLoading && <ActivityIndicator size="small" color="#00C853" style={{ marginVertical: 10 }} />}

              {searchResults.length > 0 && (
                <View style={styles.searchResultsContainer}>
                  <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={styles.searchResultItem} onPress={() => handleAddMember(item)}>
                        <Text style={styles.searchResultName}>{item.name}</Text>
                        <Text style={styles.searchResultEmail}>{item.email}</Text>
                      </TouchableOpacity>
                    )}
                    nestedScrollEnabled
                    style={{ maxHeight: 200 }}
                  />
                </View>
              )}

              {selectedMembers.length > 0 && (
                <View style={styles.selectedMembersContainer}>
                  <Text style={styles.subLabel}>Membres sélectionnés</Text>
                  {selectedMembers.map((member) => (
                    <View key={member._id} style={styles.memberItem}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <TouchableOpacity onPress={() => handleRemoveMember(member._id)}>
                        <Ionicons name="close-circle" size={20} color="#FF5252" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.offlineWarning}>
              <Ionicons name="cloud-offline" size={20} color="#FF5252" />
              <Text style={styles.offlineWarningText}>
                Mode hors ligne : l'ajout de membres sera disponible lorsque vous serez connecté
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.submitButton} onPress={handleCreateProject} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>
                  {isNetworkAvailable ? "Créer le projet" : "Créer le projet (hors ligne)"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
    textAlign: "center",
  },
  formContainer: {
    padding: 16,
  },
  label: {
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 8,
    fontWeight: "500",
  },
  subLabel: {
    fontSize: 14,
    color: "#CCCCCC",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#96c06e",
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    color: "#FFFFFF",
  },
  textArea: {
    height: 100,
  },
  mapContainer: {
    height: 200,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 10,
  },
  mapLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#333",
  },
  mapError: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#333",
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 10,
  },
  mapActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#444",
    borderRadius: 8,
    padding: 12,
    flex: 1,
    marginRight: 8,
  },
  locationButtonText: {
    color: "#FFFFFF",
    marginLeft: 8,
    fontWeight: "500",
  },
  preloadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2196F3",
    borderRadius: 8,
    padding: 12,
    flex: 1,
    marginLeft: 8,
  },
  preloadButtonText: {
    color: "#FFFFFF",
    marginLeft: 8,
    fontWeight: "500",
  },
  searchResultsContainer: {
    marginBottom: 20,
    backgroundColor: "#333",
    borderRadius: 8,
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#444",
  },
  searchResultName: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  searchResultEmail: {
    color: "#AAAAAA",
    fontSize: 12,
  },
  selectedMembersContainer: {
    marginBottom: 20,
  },
  memberItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#333",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  memberName: {
    color: "#FFFFFF",
  },
  submitButton: {
    backgroundColor: "#00C853",
    borderRadius: 30,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    flexDirection: "row",
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  errorText: {
    color: "#FF5252",
    textAlign: "center",
    marginVertical: 10,
    paddingHorizontal: 16,
  },
  offlineWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 82, 82, 0.1)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  offlineWarningText: {
    color: "#FF5252",
    marginLeft: 8,
    fontSize: 12,
  },
})

export default AddProjectScreen