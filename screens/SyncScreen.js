"use client"

import { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  Animated,
  Easing
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import api from "../services/api"
import { isOnline } from "../services/network"
import NetworkStatus from "../components/NetworkStatus"

const SyncScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [pendingRequests, setPendingRequests] = useState([])
  const [offlineMode, setOfflineMode] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [cacheInfo, setCacheInfo] = useState({
    projects: 0,
    trees: 0,
    users: 0,
    history: 0,
  })
  const [syncProgress, setSyncProgress] = useState({
    current: 0,
    total: 0,
    percent: 0
  })
  const progressAnim = useRef(new Animated.Value(0)).current
  const [failedRequests, setFailedRequests] = useState([])

  useEffect(() => {
    loadSyncData()
    const interval = setInterval(checkConnectionStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const checkConnectionStatus = async () => {
    const online = await isOnline()
    setOfflineMode(!online)
  }

  const loadSyncData = async () => {
    try {
      setLoading(true)
      await checkConnectionStatus()
      
      // Chargement parallèle des données
      const [queue, lastSyncTime] = await Promise.all([
        api.getOfflineQueue(),
        AsyncStorage.getItem("lastSyncTimestamp")
      ])
      
      setPendingRequests(queue)
      setLastSync(lastSyncTime ? new Date(Number.parseInt(lastSyncTime)) : null)
      await loadCacheInfo()
    } catch (error) {
      console.error("Erreur chargement synchronisation:", error)
      Alert.alert("Erreur", "Chargement des données de synchronisation échoué")
    } finally {
      setLoading(false)
    }
  }

  const loadCacheInfo = async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys()
      
      // Récupération parallèle des données de cache
      const [projectsKey, treesKeys, usersKeys, historyKeys] = await Promise.all([
        allKeys.filter(key => key === "cached_projects"),
        allKeys.filter(key => 
          key.startsWith("cache_/trees") || 
          (key.startsWith("cache_/projects") && key.includes("/trees"))
        ),
        allKeys.filter(key => key.startsWith("cache_/users")),
        allKeys.filter(key => key.startsWith("tree_history_"))
      ])
      
      // Traitement parallèle
      const [projectsData, treesData, usersData, historyData] = await Promise.all([
        projectsKey.length > 0 ? AsyncStorage.getItem(projectsKey[0]) : null,
        AsyncStorage.multiGet(treesKeys),
        AsyncStorage.multiGet(usersKeys),
        AsyncStorage.multiGet(historyKeys)
      ])
      
      setCacheInfo({
        projects: projectsData ? JSON.parse(projectsData).length : 0,
        trees: treesData.reduce((acc, [_, value]) => {
          if (value) {
            const parsed = JSON.parse(value)
            return acc + (Array.isArray(parsed) ? parsed.length : 1)
          }
          return acc
        }, 0),
        users: usersData.reduce((acc, [_, value]) => {
          if (value) {
            const parsed = JSON.parse(value)
            return acc + (Array.isArray(parsed) ? parsed.length : 1)
          }
          return acc
        }, 0),
        history: historyData.reduce((acc, [_, value]) => {
          if (value) {
            const parsed = JSON.parse(value)
            return acc + Object.keys(parsed).length
          }
          return acc
        }, 0)
      })
    } catch (error) {
      console.error("Erreur chargement cache:", error)
    }
  }

  const handleSync = async () => {
    if (offlineMode) {
      Alert.alert("Mode hors ligne", "Connectez-vous à Internet pour synchroniser")
      return
    }

    if (pendingRequests.length === 0) {
      Alert.alert("Information", "Aucune requête en attente")
      return
    }

    try {
      setSyncing(true)
      setSyncProgress({
        current: 0,
        total: pendingRequests.length,
        percent: 0
      })
      setFailedRequests([])
      
      // Initialiser l'animation
      progressAnim.setValue(0)
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: false
      }).start()

      // Traiter les requêtes avec suivi de progression
      const result = await api.processPendingRequests(
        (current, total) => {
          const percent = Math.round((current / total) * 100)
          setSyncProgress({ current, total, percent })
          progressAnim.setValue(current / total)
        },
        (failedRequest) => {
          setFailedRequests(prev => [...prev, failedRequest])
        }
      )

      const now = Date.now()
      await AsyncStorage.setItem("lastSyncTimestamp", now.toString())
      setLastSync(new Date(now))
      await loadSyncData()

      if (failedRequests.length > 0) {
        Alert.alert(
          "Synchronisation partielle",
          `${result.processed} requêtes traitées, ${failedRequests.length} échecs`,
          [
            { 
              text: "Voir les erreurs", 
              onPress: () => setShowErrors(true) 
            },
            { text: "OK" }
          ]
        )
      } else {
        Alert.alert("Succès", `${result.processed} requêtes synchronisées`)
      }
    } catch (error) {
      console.error("Erreur synchronisation:", error)
      Alert.alert("Erreur", "Échec de la synchronisation")
    } finally {
      setSyncing(false)
    }
  }

  const handleRetryFailed = async () => {
    if (failedRequests.length === 0) return
    
    try {
      setSyncing(true)
      setPendingRequests(prev => [...prev, ...failedRequests])
      setFailedRequests([])
      await handleSync()
    } catch (error) {
      console.error("Erreur nouvelle tentative:", error)
    }
  }

  const handleClearCache = () => {
    Alert.alert(
      "Confirmation",
      "Vider toutes les données mises en cache ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Vider",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true)
              const allKeys = await AsyncStorage.getAllKeys()
              const cacheKeys = allKeys.filter(
                key => key.startsWith("cache_") || 
                       key === "cached_projects" || 
                       key.startsWith("tree_history_")
              )
              
              if (cacheKeys.length > 0) {
                await AsyncStorage.multiRemove(cacheKeys)
              }
              
              await loadCacheInfo()
              Alert.alert("Succès", "Cache vidé")
            } catch (error) {
              console.error("Erreur vidage cache:", error)
              Alert.alert("Erreur", "Échec du vidage")
            } finally {
              setLoading(false)
            }
          },
        },
      ]
    )
  }

  const renderRequestItem = ({ item }) => {
    const getRequestType = () => {
      if (item.url.includes("/projects") && !item.url.includes("/trees")) return "Projet"
      if (item.url.includes("/trees")) return "Arbre"
      if (item.url.includes("/users")) return "Utilisateur"
      if (item.url.includes("/history")) return "Historique"
      return "Donnée"
    }
    
    const getActionType = () => {
      switch(item.method) {
        case "POST": return { text: "Création", color: "#4CAF50", icon: "add" }
        case "PUT": return { text: "Mise à jour", color: "#2196F3", icon: "pencil" }
        case "DELETE": return { text: "Suppression", color: "#F44336", icon: "trash" }
        default: return { text: "Action", color: "#9E9E9E", icon: "cloud-upload" }
      }
    }
    
    const action = getActionType()
    const entity = getRequestType()
    const isFailed = failedRequests.some(req => req.id === item.id)

    return (
      <View style={[styles.requestItem, isFailed && styles.failedRequest]}>
        <View style={styles.requestHeader}>
          <View style={styles.requestTypeContainer}>
            <Ionicons 
              name={action.icon} 
              size={16} 
              color={isFailed ? "#F44336" : action.color} 
            />
            <Text style={[styles.requestType, { color: isFailed ? "#F44336" : action.color }]}>
              {action.text} • {entity}
            </Text>
          </View>
          <Text style={styles.requestDate}>
            {new Date(item.timestamp).toLocaleTimeString()}
          </Text>
        </View>
        <Text style={styles.requestUrl} numberOfLines={1} ellipsizeMode="tail">
          {item.url.replace(api.baseURL, "")}
        </Text>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3A7D1D" />
        <Text style={styles.loadingText}>Chargement des données...</Text>
      </View>
    )
  }

  // Interpolation pour l'animation de progression
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
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
        <Text style={styles.title}>Synchronisation</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {offlineMode && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline" size={20} color="#000" />
            <Text style={styles.offlineText}>Mode hors ligne - Synchronisation désactivée</Text>
          </View>
        )}

        {/* Section de statut */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>État de synchronisation</Text>
          
          <View style={styles.statusGrid}>
            <View style={styles.statusItem}>
              <Ionicons name="time" size={20} color="#5D4037" />
              <View style={styles.statusTextContainer}>
                <Text style={styles.statusLabel}>Dernière synchro</Text>
                <Text style={styles.statusValue}>
                  {lastSync ? lastSync.toLocaleTimeString() : "Jamais"}
                </Text>
              </View>
            </View>
            
            <View style={styles.statusItem}>
              <Ionicons name="list" size={20} color="#5D4037" />
              <View style={styles.statusTextContainer}>
                <Text style={styles.statusLabel}>Requêtes en attente</Text>
                <Text style={[styles.statusValue, pendingRequests.length > 0 && styles.pendingValue]}>
                  {pendingRequests.length}
                </Text>
              </View>
            </View>
            
            <View style={styles.statusItem}>
              <Ionicons name="wifi" size={20} color="#5D4037" />
              <View style={styles.statusTextContainer}>
                <Text style={styles.statusLabel}>Connexion</Text>
                <Text style={[styles.statusValue, !offlineMode && styles.onlineValue]}>
                  {offlineMode ? "Hors ligne" : "En ligne"}
                </Text>
              </View>
            </View>
            
            <View style={styles.statusItem}>
              <Ionicons name="warning" size={20} color="#5D4037" />
              <View style={styles.statusTextContainer}>
                <Text style={styles.statusLabel}>Échecs</Text>
                <Text style={[styles.statusValue, failedRequests.length > 0 && styles.failedValue]}>
                  {failedRequests.length}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section de cache */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Données en cache</Text>
          
          <View style={styles.cacheGrid}>
            <View style={styles.cacheItem}>
              <View style={[styles.cacheIcon, { backgroundColor: "#E8F5E9" }]}>
                <Ionicons name="folder" size={24} color="#3A7D1D" />
              </View>
              <Text style={styles.cacheValue}>{cacheInfo.projects}</Text>
              <Text style={styles.cacheLabel}>Projets</Text>
            </View>
            
            <View style={styles.cacheItem}>
              <View style={[styles.cacheIcon, { backgroundColor: "#E8F5E9" }]}>
                <Ionicons name="leaf" size={24} color="#3A7D1D" />
              </View>
              <Text style={styles.cacheValue}>{cacheInfo.trees}</Text>
              <Text style={styles.cacheLabel}>Arbres</Text>
            </View>
            
            <View style={styles.cacheItem}>
              <View style={[styles.cacheIcon, { backgroundColor: "#E3F2FD" }]}>
                <Ionicons name="people" size={24} color="#1976D2" />
              </View>
              <Text style={styles.cacheValue}>{cacheInfo.users}</Text>
              <Text style={styles.cacheLabel}>Utilisateurs</Text>
            </View>
            
            <View style={styles.cacheItem}>
              <View style={[styles.cacheIcon, { backgroundColor: "#F3E5F5" }]}>
                <Ionicons name="time" size={24} color="#7B1FA2" />
              </View>
              <Text style={styles.cacheValue}>{cacheInfo.history}</Text>
              <Text style={styles.cacheLabel}>Historiques</Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.clearCacheButton} 
            onPress={handleClearCache}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="trash" size={16} color="#FFFFFF" />
                <Text style={styles.clearCacheText}>Vider le cache</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Barre de progression */}
        {syncing && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Synchronisation en cours</Text>
            
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <ActivityIndicator size="small" color="#3A7D1D" />
                <Text style={styles.progressText}>
                  {syncProgress.current}/{syncProgress.total} requêtes
                </Text>
              </View>
              
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[styles.progressFill, { width: progressWidth }]} 
                />
              </View>
              
              <Text style={styles.progressPercent}>
                {syncProgress.percent}% complété
              </Text>
            </View>
          </View>
        )}

        {/* Requêtes en attente */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Requêtes en attente</Text>
            {pendingRequests.length > 0 && (
              <TouchableOpacity onPress={handleSync} disabled={offlineMode || syncing}>
                <Ionicons 
                  name="sync" 
                  size={20} 
                  color={offlineMode || syncing ? "#BDBDBD" : "#3A7D1D"} 
                />
              </TouchableOpacity>
            )}
          </View>
          
          {pendingRequests.length > 0 ? (
            <FlatList
              data={pendingRequests}
              renderItem={renderRequestItem}
              keyExtractor={(item, index) => `request-${item.id || index}`}
              scrollEnabled={true}
              style={styles.requestsList}
              contentContainerStyle={{ paddingBottom: 10 }}
            />
          ) : (
            <View style={styles.emptyRequestsContainer}>
              <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
              <Text style={styles.emptyRequestsText}>Tout est synchronisé</Text>
            </View>
          )}
        </View>

        {/* Bouton d'action principal */}
        {!syncing && (
          <TouchableOpacity
            style={[
              styles.syncButton, 
              (offlineMode || pendingRequests.length === 0) && styles.disabledButton
            ]}
            onPress={handleSync}
            disabled={offlineMode || pendingRequests.length === 0 || syncing}
          >
            <Ionicons 
              name="sync" 
              size={20} 
              color="#FFFFFF" 
              style={syncing ? styles.rotate : null} 
            />
            <Text style={styles.syncButtonText}>
              {pendingRequests.length > 0 ? 
                `Synchroniser (${pendingRequests.length})` : 
                "Tout est synchronisé"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Bouton pour réessayer les échecs */}
        {failedRequests.length > 0 && !syncing && (
          <TouchableOpacity
            style={[styles.retryButton, styles.card]}
            onPress={handleRetryFailed}
          >
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>
              Réessayer les {failedRequests.length} échecs
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
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
    backgroundColor: "#c1dbb0",
  },
  loadingText: {
    marginTop: 16,
    color: "#3A7D1D",
    fontSize: 16,
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
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF9C4",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  offlineText: {
    marginLeft: 8,
    color: "#5D4037",
    fontWeight: "500",
    flex: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#3A7D1D",
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  statusItem: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  statusTextContainer: {
    marginLeft: 10,
  },
  statusLabel: {
    fontSize: 14,
    color: "#757575",
  },
  statusValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#212121",
    marginTop: 2,
  },
  pendingValue: {
    color: "#FF9800",
  },
  onlineValue: {
    color: "#4CAF50",
  },
  failedValue: {
    color: "#F44336",
  },
  cacheGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  cacheItem: {
    width: "48%",
    alignItems: "center",
    marginBottom: 12,
  },
  cacheIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  cacheValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#3A7D1D",
  },
  cacheLabel: {
    fontSize: 14,
    color: "#757575",
    marginTop: 4,
  },
  clearCacheButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F44336",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  clearCacheText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    marginLeft: 8,
  },
  requestsList: {
    maxHeight: 300,
  },
  requestItem: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  failedRequest: {
    borderLeftWidth: 4,
    borderLeftColor: "#F44336",
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  requestTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  requestType: {
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 6,
  },
  requestDate: {
    fontSize: 12,
    color: "#9E9E9E",
  },
  requestUrl: {
    fontSize: 12,
    color: "#616161",
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  emptyRequestsContainer: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyRequestsText: {
    fontSize: 16,
    color: "#9E9E9E",
    marginTop: 12,
    textAlign: "center",
  },
  progressContainer: {
    marginTop: 8,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: "#616161",
    marginLeft: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#E0E0E0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#4CAF50",
  },
  progressPercent: {
    fontSize: 12,
    color: "#9E9E9E",
    textAlign: "right",
    marginTop: 4,
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3A7D1D",
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
  },
  rotate: {
    transform: [{ rotate: "360deg" }],
  },
  syncButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 8,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F44336",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
})

export default SyncScreen