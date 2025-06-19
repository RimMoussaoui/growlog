"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import MapComponent from "../components/MapComponent"
import api from "../services/api"
import { isOnline } from "../services/network"
import NetworkStatus from "../components/NetworkStatus"
import { useMapTiles } from "../components/MapTileProvider"
import * as Location from "expo-location"
import AsyncStorage from "@react-native-async-storage/async-storage"

const { width, height } = Dimensions.get("window")

const ProjectMapScreen = ({ route, navigation }) => {
  const { projectId, projectName, newTreeLocation } = route.params
  const [project, setProject] = useState(null)
  const [trees, setTrees] = useState([])
  const [filteredTrees, setFilteredTrees] = useState([])
  const [loading, setLoading] = useState(true)
  const [mapRegion, setMapRegion] = useState(null)
  const [mapMarkers, setMapMarkers] = useState([])
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTree, setSelectedTree] = useState(null)
  const [mapType, setMapType] = useState("satellite")
  const { preloadRegion } = useMapTiles()
  const mapRef = useRef(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showUserLocation, setShowUserLocation] = useState(false)
  const [offlineBannerVisible, setOfflineBannerVisible] = useState(false)
  const [pendingTreesCount, setPendingTreesCount] = useState(0)
  const [pendingActions, setPendingActions] = useState([])

  // Fonction pour rafraîchir les données du projet
  const refreshProjectData = useCallback(async () => {
    await loadProjectData()
    setRefreshKey((prev) => prev + 1)
  }, [projectId])

  // Synchroniser les arbres ajoutés hors ligne
  const syncOfflineTrees = useCallback(async () => {
    if (pendingActions.length === 0 || isOfflineMode) return
    
    try {
      const actionsToProcess = [...pendingActions]
      setPendingActions([])
      
      for (const tree of actionsToProcess) {
        try {
          // Envoyer l'arbre au serveur
          const response = await api.post(`/projects/${projectId}/trees`, tree)
          
          // Mettre à jour le stockage local
          const localTreesKey = `localTrees_${projectId}`
          const localTreesString = await AsyncStorage.getItem(localTreesKey)
          let localTrees = localTreesString ? JSON.parse(localTreesString) : []
          
          // Retirer l'arbre synchronisé
          localTrees = localTrees.filter(t => t.tempId !== tree.tempId)
          await AsyncStorage.setItem(localTreesKey, JSON.stringify(localTrees))
        } catch (error) {
          console.error("Erreur de synchronisation d'arbre:", error)
          // Remettre dans la file d'attente en cas d'échec
          setPendingActions(prev => [...prev, tree])
        }
      }
      
      // Recharger les données après synchronisation
      refreshProjectData()
    } catch (error) {
      console.error("Erreur lors de la synchronisation:", error)
    }
  }, [pendingActions, isOfflineMode, projectId])

  // Vérifier la connexion et synchroniser
  useEffect(() => {
    const checkAndSync = async () => {
      const online = await isOnline()
      setIsOfflineMode(!online)
      
      if (online && pendingActions.length > 0) {
        syncOfflineTrees()
      }
    }
    
    const interval = setInterval(checkAndSync, 30000)
    return () => clearInterval(interval)
  }, [pendingActions])

  // Écouter les événements de focus
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      refreshProjectData()
    })
    return unsubscribe
  }, [navigation, refreshProjectData])

  // Charger les données du projet et des arbres
  useEffect(() => {
    loadProjectData()
    checkConnectionStatus()

    const connectionInterval = setInterval(checkConnectionStatus, 10000)
    return () => clearInterval(connectionInterval)
  }, [projectId])

  // Centrer sur le nouvel arbre ajouté
  useEffect(() => {
    if (newTreeLocation) {
      const newRegion = {
        latitude: newTreeLocation.latitude,
        longitude: newTreeLocation.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }
      setMapRegion(newRegion)
      refreshProjectData()
    }
  }, [newTreeLocation])

  // Filtrer les arbres
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredTrees(trees)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = trees.filter(
        (tree) =>
          (tree.name && tree.name.toLowerCase().includes(query)) ||
          (tree.species && tree.species.toLowerCase().includes(query)) ||
          (tree.description && tree.description.toLowerCase().includes(query)),
      )
      setFilteredTrees(filtered)
    }
    updateMapMarkers(filteredTrees)
  }, [searchQuery, trees])

  // Vérifier l'état de la connexion
  const checkConnectionStatus = async () => {
    try {
      const online = await isOnline()
      const wasOffline = isOfflineMode
      setIsOfflineMode(!online)

      if (!online && !wasOffline) {
        setOfflineBannerVisible(true)
        setTimeout(() => setOfflineBannerVisible(false), 5000)
      }
      
      // Synchroniser si on revient en ligne
      if (online && wasOffline && pendingActions.length > 0) {
        syncOfflineTrees()
      }
    } catch (error) {
      console.error("Erreur lors de la vérification de la connexion:", error)
      setIsOfflineMode(true)
    }
  }

  // Sauvegarder le projet localement
  const saveProjectLocally = async (projectData) => {
    try {
      const localProjects = await AsyncStorage.getItem("localProjects") || "[]"
      const parsedProjects = JSON.parse(localProjects)
      const existingIndex = parsedProjects.findIndex(p => p._id === projectData._id)
      
      if (existingIndex >= 0) {
        parsedProjects[existingIndex] = projectData
      } else {
        parsedProjects.push(projectData)
      }
      
      await AsyncStorage.setItem("localProjects", JSON.stringify(parsedProjects))
    } catch (error) {
      console.error("Erreur de sauvegarde locale du projet:", error)
    }
  }

  // Charger les données du projet et des arbres
  const loadProjectData = async () => {
    try {
      setLoading(true)
      const online = await isOnline()
      setIsOfflineMode(!online)

      // Charger le projet
      if (online) {
        try {
          const projectData = await api.get(`/projects/${projectId}`)
          setProject(projectData)
          saveProjectLocally(projectData)

          if (!mapRegion && projectData?.location) {
            setMapRegion({
              latitude: projectData.location.lat || 0,
              longitude: projectData.location.lng || 0,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            })
          }
        } catch (projectError) {
          console.error("Erreur API projet:", projectError)
        }
      }

      // Essayer de charger depuis le stockage local
      if (!project) {
        try {
          const localProjectsString = await AsyncStorage.getItem("localProjects")
          if (localProjectsString) {
            const localProjects = JSON.parse(localProjectsString)
            const localProject = localProjects.find(p => p._id === projectId)
            if (localProject) {
              setProject(localProject)
              
              if (!mapRegion && localProject.location) {
                setMapRegion({
                  latitude: localProject.location.lat || 0,
                  longitude: localProject.location.lng || 0,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                })
              }
            }
          }
        } catch (localError) {
          console.error("Erreur projet local:", localError)
        }
      }

      // Charger les arbres
      let treesData = []
      const localTreesKey = `localTrees_${projectId}`
      
      if (online) {
        try {
          treesData = await api.get(`/projects/${projectId}/trees`)
          // Sauvegarder localement
          await AsyncStorage.setItem(localTreesKey, JSON.stringify(treesData))
        } catch (apiTreesError) {
          console.error("Erreur API arbres:", apiTreesError)
        }
      }

      // Charger les arbres locaux
      try {
        const localTreesString = await AsyncStorage.getItem(localTreesKey)
        if (localTreesString) {
          const localTrees = JSON.parse(localTreesString)
          
          // Fusionner avec les arbres en ligne
          const onlineIds = new Set(treesData.map(t => t._id))
          const uniqueLocalTrees = localTrees.filter(t => !onlineIds.has(t._id))
          
          treesData = [...treesData, ...uniqueLocalTrees]
          
          // Mettre à jour le compteur d'actions en attente
          const pending = localTrees.filter(t => t.tempId).length
          setPendingTreesCount(pending)
          setPendingActions(localTrees.filter(t => t.tempId))
        }
      } catch (localTreesError) {
        console.error("Erreur arbres locaux:", localTreesError)
      }

      // Normaliser les données de localisation
      if (treesData && treesData.length > 0) {
        treesData.forEach(tree => {
          if (tree.location) {
            if (tree.location.lat !== undefined && tree.location.lng !== undefined) {
              tree.location.latitude = tree.location.lat
              tree.location.longitude = tree.location.lng
            } else if (tree.location.latitude !== undefined && tree.location.longitude !== undefined) {
              tree.location.lat = tree.location.latitude
              tree.location.lng = tree.location.longitude
            }
          }
        })
      }

      setTrees(treesData || [])
      setFilteredTrees(treesData || [])
      updateMapMarkers(treesData || [])
    } catch (error) {
      console.error("Erreur chargement données:", error)
      if (isOfflineMode) {
        Alert.alert("Mode hors ligne", "Certaines données peuvent ne pas être disponibles sans connexion internet.")
      } else {
        Alert.alert("Erreur", "Impossible de charger les données du projet")
      }
    } finally {
      setLoading(false)
    }
  }

  // Mettre à jour les marqueurs sur la carte
  const updateMapMarkers = (treesData) => {
    const markers = []

    if (treesData && treesData.length > 0) {
      treesData.forEach((tree) => {
        if (tree.location) {
          const lat = tree.location.latitude || tree.location.lat
          const lng = tree.location.longitude || tree.location.lng

          if (lat && lng) {
            markers.push({
              latitude: lat,
              longitude: lng,
              title: tree.name || "Arbre",
              description: tree.species || "Espèce inconnue",
              type: "tree",
              treeId: tree._id || tree.tempId,
              isLocal: !!tree.tempId,
            })
          }
        }
      })
    }

    if (project?.location) {
      const lat = project.location.latitude || project.location.lat
      const lng = project.location.longitude || project.location.lng

      if (lat && lng) {
        markers.push({
          latitude: lat,
          longitude: lng,
          title: project.name || "Projet",
          description: "Emplacement du projet",
          type: "project",
        })
      }
    }

    setMapMarkers(markers)
  }

  // Gérer le clic sur un marqueur
  const handleMarkerPress = (marker) => {
    if (marker && marker.treeId) {
      navigation.navigate("TreeDetails", { 
        treeId: marker.treeId, 
        projectId,
        isLocal: marker.isLocal
      })
    }
  }

  // Naviguer vers l'écran de détail d'un arbre
  const handleTreePress = (tree) => {
    navigation.navigate("TreeDetails", { 
      treeId: tree._id || tree.tempId, 
      projectId,
      isLocal: !!tree.tempId
    })
  }

  // Ajouter un nouvel arbre
  const handleAddTree = () => {
    const params = {
      projectId: projectId,
      isOfflineMode,
      onTreeAdded: (newTree) => {
        if (isOfflineMode) {
          // Stocker localement
          const tempId = `local-${Date.now()}`
          const treeWithTempId = { ...newTree, tempId }
          
          const localTreesKey = `localTrees_${projectId}`
          AsyncStorage.getItem(localTreesKey).then(localTreesString => {
            const localTrees = localTreesString ? JSON.parse(localTreesString) : []
            const updatedTrees = [...localTrees, treeWithTempId]
            
            AsyncStorage.setItem(localTreesKey, JSON.stringify(updatedTrees)).then(() => {
              setPendingTreesCount(prev => prev + 1)
              setPendingActions(prev => [...prev, treeWithTempId])
              refreshProjectData()
            })
          })
        } else {
          refreshProjectData()
        }
      },
    }

    if (mapRegion) {
      params.initialLocation = {
        latitude: mapRegion.latitude,
        longitude: mapRegion.longitude,
      }
    }

    navigation.navigate("AddTree", params)
  }

  // Centrer sur la position actuelle
  const centerOnCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") return

      setLoading(true)
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }).catch(error => {
        console.error("Erreur localisation:", error)
        if (isOfflineMode) {
          Alert.alert("Mode hors ligne", "La localisation peut être moins précise en mode hors ligne.")
        }
        return null
      })

      if (!currentLocation) {
        setLoading(false)
        return
      }

      const newRegion = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }

      setMapRegion(newRegion)
      if (mapRef.current?.setRegion) mapRef.current.setRegion(newRegion)
      setLoading(false)
    } catch (error) {
      console.error("Erreur position actuelle:", error)
      Alert.alert("Erreur", "Impossible d'obtenir votre position actuelle")
      setLoading(false)
    }
  }

  // Gestion des opérations hors ligne
  const handleOfflineMapOperation = (operation, callback) => {
    if (isOfflineMode) {
      Alert.alert(
        "Mode hors ligne",
        `L'opération "${operation}" peut être limitée en mode hors ligne. Seules les tuiles préchargées seront disponibles.`,
        [
          { text: "Annuler", style: "cancel" },
          { text: "Continuer", onPress: callback },
        ],
      )
    } else {
      callback()
    }
  }

  // Changer le type de carte
  const toggleMapType = () => {
    handleOfflineMapOperation("Changer le type de carte", () => {
      setMapType(mapType === "satellite" ? "standard" : "satellite")
    })
  }

  // Activer/désactiver la position utilisateur
  const toggleUserLocation = async () => {
    if (!showUserLocation) {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") return
      setShowUserLocation(true)
      centerOnCurrentLocation()
    } else {
      setShowUserLocation(false)
    }
  }

  // Précharger les tuiles
  const handlePreloadTiles = async () => {
    if (!mapRegion) {
      Alert.alert("Erreur", "Aucune région de carte définie")
      return
    }

    try {
      Alert.alert(
        "Préchargement des tuiles",
        "Voulez-vous précharger les tuiles de carte pour cette région? Cela peut prendre un certain temps et consommer des données.",
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Précharger",
            onPress: async () => {
              setLoading(true)
              const region = {
                minLat: mapRegion.latitude - mapRegion.latitudeDelta,
                maxLat: mapRegion.latitude + mapRegion.latitudeDelta,
                minLon: mapRegion.longitude - mapRegion.longitudeDelta,
                maxLon: mapRegion.longitude + mapRegion.longitudeDelta,
                minZoom: 12,
                maxZoom: 16,
              }

              const result = await preloadRegion(region, 12, 16)
              setLoading(false)
              
              if (result.success) {
                Alert.alert(
                  "Préchargement terminé",
                  `${result.count} tuiles téléchargées, ${result.skipped || 0} déjà en cache, ${result.errors} erreurs.`,
                )
              } else {
                Alert.alert("Erreur", "Impossible de précharger les tuiles. Vérifiez votre connexion.")
              }
            },
          },
        ],
      )
    } catch (error) {
      console.error("Erreur préchargement tuiles:", error)
      setLoading(false)
      Alert.alert("Erreur", "Impossible de précharger les tuiles")
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00C853" />
        <Text style={styles.loadingText}>Chargement de la carte...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <NetworkStatus />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {projectName || project?.name || "Carte du projet"}
        </Text>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate("ProjectDetail", { projectId })}>
          <Ionicons name="menu" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher des arbres..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.mapContainer}>
        {mapRegion ? (
          <MapComponent
            key={refreshKey}
            ref={mapRef}
            initialRegion={mapRegion}
            markers={mapMarkers}
            onMarkerPress={handleMarkerPress}
            zoomEnabled={true}
            scrollEnabled={true}
            rotateEnabled={true}
            mapType={mapType}
            showsUserLocation={showUserLocation}
            style={styles.map}
          />
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderText}>Aucune localisation disponible</Text>
          </View>
        )}

        {isOfflineMode && (
          <View style={styles.offlineMapBanner}>
            <Ionicons name="cloud-offline" size={14} color="#000" />
            <Text style={styles.offlineMapText}>Mode hors ligne - Carte limitée aux tuiles préchargées</Text>
          </View>
        )}

        {offlineBannerVisible && (
          <View style={styles.offlineNotification}>
            <Ionicons name="cloud-offline" size={20} color="#FFFFFF" />
            <Text style={styles.offlineNotificationText}>Vous êtes passé en mode hors ligne</Text>
          </View>
        )}

        {pendingTreesCount > 0 && (
          <View style={styles.pendingActionsBanner}>
            <Ionicons name="time-outline" size={16} color="#000" />
            <Text style={styles.pendingActionsText}>
              {pendingTreesCount} arbre(s) en attente de synchronisation
            </Text>
          </View>
        )}

        <View style={styles.mapButtonsContainer}>
          <TouchableOpacity style={styles.mapButton} onPress={toggleMapType}>
            <Ionicons name={mapType === "satellite" ? "map" : "globe"} size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mapButton, showUserLocation && styles.mapButtonActive]}
            onPress={toggleUserLocation}
          >
            <Ionicons name="location" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.mapButton} onPress={handlePreloadTiles}>
            <Ionicons name="download" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.mapButton} onPress={centerOnCurrentLocation}>
            <Ionicons name="locate" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.mapButton} onPress={refreshProjectData}>
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.addButton} onPress={handleAddTree}>
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#c1dbb0",
  },
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingBottom: 10,
    backgroundColor: "#c1dbb0",
    zIndex: 10,
  },
  backButton: {
    padding: 8,
  },
  menuButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    flex: 1,
    textAlign: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    height: 50,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 50,
    color: "#333",
    fontSize: 16,
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#333",
  },
  mapPlaceholderText: {
    color: "#AAAAAA",
    fontSize: 16,
  },
  offlineMapBanner: {
    position: "absolute",
    top: 10,
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
  offlineNotification: {
    position: "absolute",
    top: 60,
    left: 10,
    right: 10,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  offlineNotificationText: {
    color: "#FFFFFF",
    fontSize: 14,
    marginLeft: 8,
    fontWeight: "bold",
  },
  pendingActionsBanner: {
    position: "absolute",
    bottom: 80,
    left: 10,
    right: 10,
    backgroundColor: "rgba(255, 193, 7, 0.9)",
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  pendingActionsText: {
    color: "#000000",
    fontSize: 14,
    marginLeft: 8,
    fontWeight: "bold",
  },
  mapButtonsContainer: {
    position: "absolute",
    right: 16,
    top: 20,
    flexDirection: "column",
    gap: 10,
  },
  mapButton: {
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  addButton: {
    position: "absolute",
    right: 16,
    bottom: 20,
    backgroundColor: "#00C853",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  mapButtonActive: {
    backgroundColor: "rgba(0, 200, 83, 0.8)",
  },
})

export default ProjectMapScreen