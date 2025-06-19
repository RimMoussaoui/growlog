import React, { useState, useEffect, useLayoutEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ImageBackground,
  ScrollView,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import api from "../services/api"
import * as AuthService from "../services/auth"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { isOnline } from "../services/network"
import NetworkStatus from "../components/NetworkStatus"
import { useMapTiles } from "../components/MapTileProvider"

const PROJECTS_STORAGE_KEY = "@user_projects";

const HomeScreen = ({ navigation }) => {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [offlineMode, setOfflineMode] = useState(false)
  const [pendingSync, setPendingSync] = useState(0)
  const { cacheStats } = useMapTiles()

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    })
  }, [navigation])

  useEffect(() => {
    loadUserAndProjects()
    const unsubscribe = navigation.addListener("focus", loadUserAndProjects)
    const connectionInterval = setInterval(checkConnectionStatus, 10000)

    return () => {
      unsubscribe()
      clearInterval(connectionInterval)
    }
  }, [navigation])

  const saveProjectsToStorage = async (projects) => {
    try {
      await AsyncStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects))
    } catch (error) {
      console.error("Erreur de sauvegarde locale des projets", error)
    }
  }

  const loadProjectsFromStorage = async () => {
    try {
      const storedProjects = await AsyncStorage.getItem(PROJECTS_STORAGE_KEY)
      return storedProjects ? JSON.parse(storedProjects) : []
    } catch (error) {
      console.error("Erreur de chargement local des projets", error)
      return []
    }
  }

  const checkConnectionStatus = async () => {
    try {
      const online = await isOnline()
      setOfflineMode(!online)
      
      // Toujours essayer de récupérer le statut de synchronisation
      try {
        const syncStatus = await api.getSyncStatus()
        setPendingSync(syncStatus.pendingRequests || 0)
      } catch (syncError) {
        console.error("Erreur de statut de synchronisation", syncError)
      }
    } catch {
      setOfflineMode(true)
    }
  }

  const loadUserAndProjects = async () => {
    try {
      setLoading(true)
      const currentUser = await AuthService.getCurrentUser()
      setUser(currentUser)
      
      const online = await isOnline()
      setOfflineMode(!online)

      let projectsData = []
      
      if (online) {
        try {
          // Mode en ligne - charger depuis l'API
          projectsData = await api.get("/projects")
          // Sauvegarder dans le cache local
          await saveProjectsToStorage(projectsData)
        } catch (apiError) {
          console.error("Erreur API, utilisation du cache", apiError)
          projectsData = await loadProjectsFromStorage()
        }
      } else {
        // Mode hors ligne - charger depuis le cache
        projectsData = await loadProjectsFromStorage()
      }
      
      setProjects(projectsData || [])
      
      // Mettre à jour le statut de synchronisation
      try {
        const syncStatus = await api.getSyncStatus()
        setPendingSync(syncStatus.pendingRequests || 0)
      } catch (syncError) {
        console.error("Erreur de statut de synchronisation", syncError)
      }
    } catch (error) {
      console.error("Erreur générale de chargement", error)
      // Dernière tentative de chargement depuis le cache
      const cachedProjects = await loadProjectsFromStorage()
      setProjects(cachedProjects)
      Alert.alert("Mode hors ligne", "Les données locales sont affichées")
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    Alert.alert("Déconnexion", "Êtes-vous sûr de vouloir vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Déconnexion",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true)
            await AuthService.logoutUser()
            await AsyncStorage.removeItem("user_profile_direct")
            if (global.EventEmitter) global.EventEmitter.emit("logout")
            else {
              navigation.navigate("Home")
              setTimeout(() => {
                AsyncStorage.setItem("forceAuthCheck", Date.now().toString())
              }, 100)
            }
          } catch {
            Alert.alert("Erreur", "Impossible de se déconnecter")
            setLoading(false)
          }
        },
      },
    ])
  }

  const handleCreateProject = () => navigation.navigate("AddProject")
  const handleProjectPress = (project) => navigation.navigate("ProjectDetail", { projectId: project._id })
  const handleProfilePress = () => navigation.navigate("UserProfile", { userId: user?._id })
  const handleSyncPress = () => navigation.navigate("Sync")
  const handleMapCachePress = () => navigation.navigate("MapCache")

  const renderProjectItem = ({ item }) => {
    const isOwner = item.owner === user?._id
    const isPending = item._pendingSync === true

    return (
      <TouchableOpacity style={styles.projectCard} onPress={() => handleProjectPress(item)}>
        <View style={styles.projectHeader}>
          <Text style={styles.projectName}>{item.name}</Text>
          <View style={styles.badgeContainer}>
            {isPending && <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>En attente</Text></View>}
            {isOwner && <View style={styles.ownerBadge}><Text style={styles.ownerBadgeText}>Propriétaire</Text></View>}
          </View>
        </View>
        <Text style={styles.projectDescription} numberOfLines={2}>
          {item.description || "Aucune description"}
        </Text>
        <View style={styles.projectFooter}>
          <Text style={styles.projectLocation}>{item.location?.name || "Aucun lieu spécifié"}</Text>
          <View style={styles.membersContainer}>
            <Ionicons name="people" size={14} color="#555" />
            <Text style={styles.projectMembers}>{item.members?.length || 1}</Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3A7D1D" />
      </View>
    )
  }

  return (
    <ImageBackground source={require("../assets/bre.png")} style={styles.background} resizeMode="cover">
      <ScrollView contentContainerStyle={styles.scroll}>
        <NetworkStatus />
        <View style={styles.header}>
          <TouchableOpacity onPress={handleProfilePress}>
            <Ionicons name="person-circle-outline" size={32} color="#2e7d32" />
          </TouchableOpacity>
          <Text style={styles.welcomeText}>Bonjour, {user?.name || "Utilisateur"}</Text>
          <View style={styles.headerRight}>
            {/* Icône de synchronisation toujours visible */}
            <TouchableOpacity onPress={handleSyncPress} style={styles.syncButton}>
              {/* Badge seulement s'il y a des éléments en attente */}
              {pendingSync > 0 && <Text style={styles.syncBadge}>{pendingSync}</Text>}
              <Ionicons name="sync" size={24} color="#2e7d32" />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={handleMapCachePress}>
              <Ionicons name="map" size={24} color="#2e7d32" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color="#2e7d32" />
            </TouchableOpacity>
          </View>
        </View>

        {offlineMode && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline" size={16} color="#000" />
            <Text style={styles.offlineText}>Mode hors ligne</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Mes projets</Text>

        {projects.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aucun projet</Text>
          </View>
        ) : (
          <FlatList
            data={projects}
            renderItem={renderProjectItem}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.projectList}
          />
        )}

        <TouchableOpacity style={styles.fabButton} onPress={handleCreateProject}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </ScrollView>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: 16,
    paddingTop: 50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#dcedc8",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  welcomeText: {
    fontSize: 18,
    color: "#2e7d32",
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#2e7d32",
    marginBottom: 16,
  },
  projectList: {
    paddingBottom: 80,
  },
  projectCard: {
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  projectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  projectName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2e7d32",
    flex: 1,
  },
  badgeContainer: {
    flexDirection: "row",
  },
  ownerBadge: {
    backgroundColor: "#66bb6a",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  ownerBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  pendingBadge: {
    backgroundColor: "#ffca28",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingBadgeText: {
    color: "#000",
    fontSize: 10,
    fontWeight: "bold",
  },
  projectDescription: {
    fontSize: 14,
    color: "#555",
    marginBottom: 12,
  },
  projectFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  projectLocation: {
    fontSize: 12,
    color: "#2e7d32",
  },
  membersContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  projectMembers: {
    fontSize: 12,
    color: "#555",
    marginLeft: 4,
  },
  fabButton: {
    position: "absolute",
    right: 20,
    bottom: 20,
    backgroundColor: "#2e7d32",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    marginTop: 40,
  },
  emptyText: {
    fontSize: 18,
    color: "#2e7d32",
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff9c4",
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  offlineText: {
    marginLeft: 8,
    color: "#000",
    fontWeight: "bold",
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  syncBadge: {
    backgroundColor: "#e53935",
    color: "#fff",
    fontSize: 10,
    borderRadius: 8,
    paddingHorizontal: 5,
    marginRight: 4,
    minWidth: 18,
    textAlign: "center",
  },
})

export default HomeScreen