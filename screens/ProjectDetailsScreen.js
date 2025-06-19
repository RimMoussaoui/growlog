"use client"

import { useEffect, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Platform,
  Modal,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import AsyncStorage from '@react-native-async-storage/async-storage'
import api from "../services/api"
import { isOnline } from "../services/network"
import NetworkStatus from "../components/NetworkStatus"
import MapComponent from "../components/MapComponent"
import { useMapTiles } from "../components/MapTileProvider"
import * as AuthService from "../services/auth"

const ProjectDetailScreen = ({ route, navigation }) => {
  const { projectId } = route.params
  const [project, setProject] = useState(null)
  const [trees, setTrees] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [mapRegion, setMapRegion] = useState(null)
  const [mapMarkers, setMapMarkers] = useState([])
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const { preloadRegion } = useMapTiles()
  const [currentUser, setCurrentUser] = useState(null)
  const [userRole, setUserRole] = useState("collaborator")
  const [offlineActions, setOfflineActions] = useState([])

  const [inviteModalVisible, setInviteModalVisible] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState(null)

  // Charger les données du projet et des arbres
  useEffect(() => {
    loadProjectData()
    checkConnectionStatus()
    loadCurrentUser()
    const connectionInterval = setInterval(checkConnectionStatus, 10000)
    return () => clearInterval(connectionInterval)
  }, [projectId])

  // Traiter les actions en attente quand la connexion revient
  useEffect(() => {
    if (!isOfflineMode && offlineActions.length > 0) {
      processOfflineActions()
    }
  }, [isOfflineMode])

  // Rechercher des utilisateurs lorsque la requête change
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length >= 2 && !isOfflineMode) {
        setSearchLoading(true)
        setInviteError(null)
        try {
          const results = await api.get(`/users/search?query=${searchQuery}`)
          const filteredResults = results.filter((user) => !members.some((member) => member._id === user._id))
          setSearchResults(filteredResults)
        } catch (error) {
          console.error("Erreur lors de la recherche d'utilisateurs:", error)
          setInviteError("Impossible de rechercher des utilisateurs. Veuillez réessayer.")
        } finally {
          setSearchLoading(false)
        }
      } else {
        setSearchResults([])
      }
    }

    const timeoutId = setTimeout(() => {
      searchUsers()
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, isOfflineMode, members])

  // Charger l'utilisateur actuel
  const loadCurrentUser = async () => {
    try {
      const user = await AuthService.getCurrentUser()
      setCurrentUser(user)
    } catch (error) {
      console.error("Erreur lors du chargement de l'utilisateur:", error)
    }
  }

  // Déterminer le rôle de l'utilisateur
  const determineUserRole = () => {
    if (!currentUser || !project) return

    const isOwner =
      project.owner === currentUser._id ||
      project.createdBy === currentUser._id ||
      members.some(
        (member) => member._id === currentUser._id && (member.role === "owner" || member.role === "propriétaire"),
      )

    const newRole = isOwner ? "owner" : "collaborator"
    setUserRole(newRole)
  }

  // Vérifier l'état de la connexion
  const checkConnectionStatus = async () => {
    try {
      const online = await isOnline()
      setIsOfflineMode(!online)
    } catch (error) {
      console.error("Erreur lors de la vérification de la connexion:", error)
      setIsOfflineMode(true)
    }
  }

  // Sauvegarder les données localement
  const saveProjectDataLocally = async (projectData, treesData, membersData) => {
    try {
      const data = {
        project: projectData,
        trees: treesData || [],
        members: membersData || [],
        timestamp: new Date().getTime(),
      };
      await AsyncStorage.setItem(`project-${projectId}`, JSON.stringify(data))
    } catch (error) {
      console.error("Erreur de sauvegarde locale:", error)
    }
  }

  // Récupérer les données locales
  const getLocalProjectData = async () => {
    try {
      const data = await AsyncStorage.getItem(`project-${projectId}`)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error("Erreur de lecture locale:", error)
      return null
    }
  }

  const loadProjectData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Vérifier la connexion
      const online = await isOnline()
      setIsOfflineMode(!online)

      if (online) {
        // Mode en ligne - charger depuis l'API
        try {
          // Charger les détails du projet
          const projectData = await api.get(`/projects/${projectId}`)
          setProject(projectData)

          // Définir la région de la carte
          if (projectData && projectData.location) {
            const region = {
              latitude: projectData.location.lat || 0,
              longitude: projectData.location.lng || 0,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }
            setMapRegion(region)
          }

          // Sauvegarder localement
          saveProjectDataLocally(projectData, trees, members)
        } catch (projectError) {
          console.error("Erreur lors du chargement du projet:", projectError)
          setError("Erreur lors du chargement des détails du projet.")
        }

        // Charger les arbres
        try {
          const treesData = await api.get(`/projects/${projectId}/trees`)
          setTrees(treesData || [])
          saveProjectDataLocally(project, treesData, members)
        } catch (treesError) {
          console.error("Erreur lors du chargement des arbres:", treesError)
          setTrees([])
        }

        // Charger les membres
        try {
          const membersData = await api.get(`/projects/${projectId}/members`)
          setMembers(membersData || [])
          saveProjectDataLocally(project, trees, membersData)
        } catch (membersError) {
          console.error("Erreur lors du chargement des membres:", membersError)
          setMembers([])
        }
      } else {
        // Mode hors ligne - charger depuis le stockage local
        const localData = await getLocalProjectData()
        if (localData) {
          setProject(localData.project)
          setTrees(localData.trees)
          setMembers(localData.members)
          
          if (localData.project?.location) {
            setMapRegion({
              latitude: localData.project.location.lat || 0,
              longitude: localData.project.location.lng || 0,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            })
          }
          updateMapMarkers(localData.project, localData.trees)
        } else {
          setError("Aucune donnée locale disponible. Connectez-vous pour charger les données.")
        }
      }

      // Mettre à jour les marqueurs de carte
      updateMapMarkers(project || {}, trees || [])

      // Déterminer le rôle de l'utilisateur
      if (currentUser) {
        determineUserRole()
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données du projet:", error)
      setError("Impossible de charger les données du projet. Vérifiez votre connexion internet.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Surveiller les changements pour déterminer le rôle
  useEffect(() => {
    if (currentUser && project && members.length >= 0) {
      determineUserRole()
    }
  }, [currentUser, project, members])

  const updateMapMarkers = (projectData, treesData) => {
    const markers = []

    // Ajouter le marqueur du projet
    if (
      projectData &&
      projectData.location &&
      (projectData.location.lat || projectData.location.latitude) &&
      (projectData.location.lng || projectData.location.longitude)
    ) {
      markers.push({
        latitude: projectData.location.lat || projectData.location.latitude || 0,
        longitude: projectData.location.lng || projectData.location.longitude || 0,
        title: projectData.name || "Projet",
        description: "Localisation du projet",
        type: "project",
      })
    }

    // Ajouter les marqueurs des arbres
    if (treesData && treesData.length > 0) {
      treesData.forEach((tree) => {
        if (
          tree.location &&
          ((tree.location.lat !== undefined && tree.location.lng !== undefined) ||
            (tree.location.latitude !== undefined && tree.location.longitude !== undefined))
        ) {
          // Normalize coordinates
          const lat = tree.location.latitude || tree.location.lat || 0
          const lng = tree.location.longitude || tree.location.lng || 0

          markers.push({
            latitude: lat,
            longitude: lng,
            title: tree.name || "Arbre",
            description: tree.species || "Espèce inconnue",
            type: "tree",
            treeId: tree._id,
          })
        }
      })
    }

    setMapMarkers(markers)
  }

  // Rafraîchir les données
  const handleRefresh = () => {
    setRefreshing(true)
    loadProjectData()
  }

  // Précharger les tuiles de carte pour cette région
  const handlePreloadMapTiles = async () => {
    if (!mapRegion) return

    try {
      // Définir la région à précharger (légèrement plus grande que la région visible)
      const region = {
        minLat: mapRegion.latitude - mapRegion.latitudeDelta,
        maxLat: mapRegion.latitude + mapRegion.latitudeDelta,
        minLon: mapRegion.longitude - mapRegion.longitudeDelta,
        maxLon: mapRegion.longitude + mapRegion.longitudeDelta,
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
              Alert.alert("Préchargement en cours", "Le préchargement des tuiles de carte est en cours...")

              // Précharger les tuiles
              const result = await preloadRegion(region)

              if (result.success) {
                Alert.alert(
                  "Préchargement terminé",
                  `${result.count} tuiles ont été téléchargées pour la région du projet.`,
                )
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

  // Gérer les actions en file d'attente
  const processOfflineActions = async () => {
    if (offlineActions.length === 0) return

    const actions = [...offlineActions]
    setOfflineActions([])
    
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'DELETE_PROJECT':
            await api.delete(`/projects/${projectId}`)
            break;
          case 'REMOVE_MEMBER':
            await api.delete(`/projects/${projectId}/members/${action.memberId}`)
            break;
          case 'ADD_MEMBERS':
            await Promise.all(action.userIds.map(userId => 
              api.post(`/projects/${projectId}/members`, { memberId: userId })
            ))
            break;
        }
      } catch (error) {
        console.error("Échec de synchronisation:", action.type, error)
        // Remettre l'action dans la file si échec
        setOfflineActions(prev => [...prev, action])
      }
    }
    
    // Recharger les données après synchronisation
    loadProjectData()
  }

  // Ouvrir le modal d'invitation
  const openAddMemberModal = () => {
    if (isOfflineMode) {
      Alert.alert(
        "Mode hors ligne",
        "L'ajout de membres n'est pas disponible en mode hors ligne. Veuillez vous connecter à Internet et réessayer.",
      )
      return
    }
    setInviteModalVisible(true)
    setSearchQuery("")
    setSearchResults([])
    setSelectedUsers([])
    setInviteError(null)
  }

  // Fermer le modal d'invitation
  const closeInviteModal = () => {
    setInviteModalVisible(false)
  }

  // Sélectionner un utilisateur à inviter
  const selectUser = (user) => {
    if (!selectedUsers.some((selectedUser) => selectedUser._id === user._id)) {
      setSelectedUsers([...selectedUsers, user])
    }
    setSearchQuery("")
    setSearchResults([])
  }

  // Désélectionner un utilisateur
  const deselectUser = (userId) => {
    setSelectedUsers(selectedUsers.filter((user) => user._id !== userId))
  }

  // Ajouter directement les membres au projet
  const addMembersDirectly = async () => {
    if (selectedUsers.length === 0) {
      setInviteError("Veuillez sélectionner au moins un utilisateur à ajouter.")
      return
    }

    if (isOfflineMode) {
      // Mode hors ligne - mettre en file d'attente
      setOfflineActions([
        ...offlineActions, 
        { 
          type: 'ADD_MEMBERS', 
          userIds: selectedUsers.map(u => u._id) 
        }
      ])
      
      // Mettre à jour l'UI immédiatement
      setMembers([...members, ...selectedUsers])
      
      Alert.alert(
        "Invitations en attente",
        `Les membres seront ajoutés lorsque vous serez en ligne`,
        [{ text: "OK" }]
      )
      closeInviteModal()
      return
    }

    setInviteLoading(true)
    setInviteError(null)

    try {
      const addMemberPromises = selectedUsers.map((user) =>
        api.post(`/projects/${projectId}/members`, {
          memberId: user._id,
        }),
      )

      const results = await Promise.all(addMemberPromises)

      // Recharger la liste des membres
      const updatedMembers = await api.get(`/projects/${projectId}/members`)
      setMembers(updatedMembers || [])

      closeInviteModal()
      Alert.alert(
        "Membres ajoutés",
        `${selectedUsers.length} membre${selectedUsers.length > 1 ? "s" : ""} ajouté${selectedUsers.length > 1 ? "s" : ""} avec succès au projet.`,
      )
    } catch (error) {
      console.error("Erreur lors de l'ajout des membres:", error)
      setInviteError("Impossible d'ajouter les membres. Veuillez réessayer.")
    } finally {
      setInviteLoading(false)
    }
  }

  // Afficher un indicateur de chargement
  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00C853" />
        <Text style={styles.loadingText}>Chargement du projet...</Text>
      </View>
    )
  }

  // Afficher un message d'erreur
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadProjectData}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Rendu d'un élément de la liste des membres
  const renderMemberItem = ({ item }) => {
    const isOwner = item._id === project?.owner || item._id === project?.createdBy
    const canRemoveMember = userRole === "owner" && !isOwner

    const handleRemoveMember = async (memberId, memberName) => {
      if (isOfflineMode) {
        // Mode hors ligne - mettre en file d'attente
        setOfflineActions([
          ...offlineActions, 
          { type: 'REMOVE_MEMBER', memberId }
        ])
        
        // Mettre à jour l'UI immédiatement
        setMembers(members.filter(m => m._id !== memberId))
        
        Alert.alert(
          "Action en attente",
          `La suppression de ${memberName} sera synchronisée plus tard`,
          [{ text: "OK" }]
        )
        return
      }

      Alert.alert("Confirmation", `Êtes-vous sûr de vouloir supprimer ${memberName} de ce projet ?`, [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true)
              await api.delete(`/projects/${projectId}/members/${memberId}`)
              const updatedMembers = await api.get(`/projects/${projectId}/members`)
              setMembers(updatedMembers || [])
            } catch (error) {
              console.error("Erreur lors de la suppression du membre:", error)
              Alert.alert("Erreur", "Impossible de supprimer le membre")
            } finally {
              setLoading(false)
            }
          },
        },
      ])
    }

    return (
      <View style={styles.memberItem}>
        <View style={styles.memberAvatar}>
          <Text style={styles.memberInitials}>{item.name ? item.name.charAt(0).toUpperCase() : "?"}</Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.name || "Membre sans nom"}</Text>
          <Text style={styles.memberEmail}>{item.email || ""}</Text>
        </View>
        <View style={styles.memberActions}>
          {isOwner ? (
            <View style={styles.ownerBadge}>
              <Text style={styles.ownerBadgeText}>Propriétaire</Text>
            </View>
          ) : (
            <>
              <View style={styles.collaboratorBadge}>
                <Text style={styles.collaboratorBadgeText}>Collaborateur</Text>
              </View>
              {canRemoveMember && (
                <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveMember(item._id, item.name)}>
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    )
  }

  // Rendu d'un élément de la liste des résultats de recherche
  const renderSearchResultItem = ({ item }) => (
    <TouchableOpacity style={styles.searchResultItem} onPress={() => selectUser(item)}>
      <View style={styles.memberAvatar}>
        <Text style={styles.memberInitials}>{item.name ? item.name.charAt(0).toUpperCase() : "?"}</Text>
      </View>
      <View style={styles.searchResultContent}>
        <Text style={styles.searchResultName}>{item.name || "Utilisateur sans nom"}</Text>
        <Text style={styles.searchResultEmail}>{item.email || ""}</Text>
      </View>
      <Ionicons name="add-circle" size={24} color="#00C853" />
    </TouchableOpacity>
  )

  // Rendu d'un élément de la liste des utilisateurs sélectionnés
  const renderSelectedUserItem = ({ item }) => (
    <View style={styles.selectedUserItem}>
      <View style={styles.memberAvatar}>
        <Text style={styles.memberInitials}>{item.name ? item.name.charAt(0).toUpperCase() : "?"}</Text>
      </View>
      <View style={styles.selectedUserContent}>
        <Text style={styles.selectedUserName}>{item.name || "Utilisateur sans nom"}</Text>
        <Text style={styles.selectedUserEmail}>{item.email || ""}</Text>
      </View>
      <TouchableOpacity onPress={() => deselectUser(item._id)}>
        <Ionicons name="close-circle" size={24} color="#FF5252" />
      </TouchableOpacity>
    </View>
  )

  const handleDeleteProject = () => {
    if (isOfflineMode) {
      // Mode hors ligne - mettre en file d'attente
      setOfflineActions([...offlineActions, { type: 'DELETE_PROJECT' }])
      Alert.alert(
        "Action en attente",
        "La suppression sera effectuée lorsque vous serez en ligne",
        [{ text: "OK" }]
      )
      navigation.goBack()
      return
    }

    Alert.alert("Confirmation", "Êtes-vous sûr de vouloir supprimer ce projet ? Cette action est irréversible.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true)
            await api.delete(`/projects/${projectId}`)
            navigation.goBack()
          } catch (error) {
            console.error("Erreur lors de la suppression du projet:", error)
            Alert.alert("Erreur", "Impossible de supprimer le projet")
            setLoading(false)
          }
        },
      },
    ])
  }

  // Afficher les actions en attente
  const renderPendingActions = () => (
    offlineActions.length > 0 && (
      <View style={styles.pendingActionsBanner}>
        <Ionicons name="time-outline" size={16} color="#000" />
        <Text style={styles.pendingActionsText}>
          {offlineActions.length} action(s) en attente de synchronisation
        </Text>
      </View>
    )
  )

  return (
    <View style={styles.container}>
      <NetworkStatus />
      {renderPendingActions()}

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {project?.name || "Détails du projet"}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#00C853"]} />}
      >
        {isOfflineMode && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline" size={18} color="#000" />
            <Text style={styles.offlineBannerText}>
              Mode hors ligne - Certaines fonctionnalités peuvent être limitées
            </Text>
          </View>
        )}

        {/* Informations du projet */}
        <View style={styles.projectInfoContainer}>
          <Text style={styles.projectName}>{project?.name || "Happy-farm"}</Text>
          <Text style={styles.projectDescription}>{project?.description || "Aucune description"}</Text>

          {project?.location?.name && (
            <View style={styles.locationContainer}>
              <Ionicons name="location" size={16} color="#00C853" />
              <Text style={styles.locationText}>{project.location.name}</Text>
            </View>
          )}
        </View>

        {/* Carte du projet */}
        <View style={styles.mapContainer}>
          <View style={styles.mapHeader}>
            <Text style={styles.sectionTitle}>Localisation</Text>
            <TouchableOpacity style={styles.preloadButton} onPress={handlePreloadMapTiles}>
              <Ionicons name="download-outline" size={16} color="#FFFFFF" />
              <Text style={styles.preloadButtonText}>Précharger</Text>
            </TouchableOpacity>
          </View>

          {mapRegion ? (
            <MapComponent
              initialRegion={mapRegion}
              markers={mapMarkers}
              zoomEnabled={true}
              scrollEnabled={true}
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
              <Text style={styles.offlineMapText}>Mode hors ligne - Carte limitée</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.visitButton}
          onPress={() => navigation.navigate("ProjectMap", { projectId: projectId, projectName: project?.name })}
        >
          <Ionicons name="map-outline" size={24} color="#FFFFFF" />
          <Text style={styles.visitButtonText}>Voir tous les arbres sur la carte ({trees.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.preloadAllButton}
          onPress={() => {
            Alert.alert(
              "Précharger toutes les tuiles",
              "Voulez-vous précharger toutes les tuiles de carte pour ce projet? Cela permettra d'utiliser la carte complète en mode hors ligne.",
              [
                { text: "Annuler", style: "cancel" },
                {
                  text: "Précharger",
                  onPress: async () => {
                    try {
                      // Vérifier si nous sommes en ligne
                      const online = await isOnline()
                      if (!online) {
                        Alert.alert("Mode hors ligne", "Vous devez être en ligne pour précharger les tuiles de carte.")
                        return
                      }

                      // Afficher un indicateur de chargement
                      Alert.alert("Préchargement en cours", "Le préchargement des tuiles de carte est en cours...")

                      // Définir une région plus large pour le préchargement
                      if (mapRegion) {
                        const region = {
                          minLat: mapRegion.latitude - mapRegion.latitudeDelta * 3,
                          maxLat: mapRegion.latitude + mapRegion.latitudeDelta * 3,
                          minLon: mapRegion.longitude - mapRegion.longitudeDelta * 3,
                          maxLon: mapRegion.longitude + mapRegion.longitudeDelta * 3,
                          minZoom: 10,
                          maxZoom: 18,
                        }

                        // Précharger les tuiles
                        const result = await preloadRegion(region)

                        if (result.success) {
                          Alert.alert(
                            "Préchargement terminé",
                            `${result.count} tuiles ont été téléchargées pour la région du projet.`,
                          )
                        } else {
                          Alert.alert("Erreur", `Le préchargement a échoué: ${result.message || "Erreur inconnue"}`)
                        }
                      }
                    } catch (error) {
                      console.error("Erreur lors du préchargement des tuiles:", error)
                      Alert.alert("Erreur", "Une erreur s'est produite lors du préchargement des tuiles.")
                    }
                  },
                },
              ],
            )
          }}
        >
          <Ionicons name="cloud-download-outline" size={24} color="#FFFFFF" />
          <Text style={styles.preloadAllButtonText}>Précharger toutes les tuiles</Text>
        </TouchableOpacity>

        {/* Liste des membres */}
        <View style={styles.membersContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Membres ({members.length})</Text>
            {(userRole === "owner" || userRole === "propriétaire") && (
              <TouchableOpacity style={styles.addMemberButton} onPress={openAddMemberModal}>
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          {members.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Aucun membre dans ce projet</Text>
              <Text style={styles.emptySubText}>Invitez des collaborateurs pour travailler ensemble</Text>
            </View>
          ) : (
            <FlatList
              data={members}
              renderItem={renderMemberItem}
              keyExtractor={(item) => item._id}
              scrollEnabled={false}
              style={styles.membersList}
            />
          )}
        </View>
      </ScrollView>

      {userRole === "owner" && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteProject}>
          <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
          <Text style={styles.deleteButtonText}>Supprimer le projet</Text>
        </TouchableOpacity>
      )}

      {/* Modal d'invitation */}
      <Modal visible={inviteModalVisible} animationType="slide" transparent={true} onRequestClose={closeInviteModal}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Ajouter des membres</Text>
                <TouchableOpacity onPress={closeInviteModal}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#AAAAAA" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Rechercher par nom ou email"
                  placeholderTextColor="#AAAAAA"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                />
                {searchLoading && <ActivityIndicator size="small" color="#00C853" style={styles.searchLoader} />}
              </View>

              {inviteError && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={18} color="#FF5252" />
                  <Text style={styles.errorBannerText}>{inviteError}</Text>
                </View>
              )}

              {searchResults.length > 0 && (
                <View style={styles.searchResultsContainer}>
                  <Text style={styles.sectionSubtitle}>Résultats de recherche</Text>
                  <FlatList
                    data={searchResults}
                    renderItem={renderSearchResultItem}
                    keyExtractor={(item) => item._id}
                    style={styles.searchResultsList}
                  />
                </View>
              )}

              {selectedUsers.length > 0 && (
                <View style={styles.selectedUsersContainer}>
                  <Text style={styles.sectionSubtitle}>Utilisateurs sélectionnés ({selectedUsers.length})</Text>
                  <FlatList
                    data={selectedUsers}
                    renderItem={renderSelectedUserItem}
                    keyExtractor={(item) => item._id}
                    style={styles.selectedUsersList}
                  />
                </View>
              )}

              <TouchableOpacity
                style={[styles.inviteButton, selectedUsers.length === 0 && styles.inviteButtonDisabled]}
                onPress={addMembersDirectly}
                disabled={selectedUsers.length === 0 || inviteLoading}
              >
                {inviteLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="person-add" size={20} color="#FFFFFF" />
                    <Text style={styles.inviteButtonText}>
                      Ajouter {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ""}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
    color: "#FFFFFF",
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#c1dbb0",
    padding: 20,
  },
  errorText: {
    color: "#FF5252",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#444",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
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
  projectInfoContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  projectName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  projectDescription: {
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 16,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationText: {
    fontSize: 14,
    color: "#6ca81f",
    marginLeft: 4,
  },
  mapContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
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
  map: {
    height: 200,
    borderRadius: 8,
    overflow: "hidden",
  },
  mapPlaceholder: {
    height: 200,
    backgroundColor: "#333",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  mapPlaceholderText: {
    color: "#AAAAAA",
  },
  offlineMapBanner: {
    position: "absolute",
    bottom: 24,
    left: 24,
    right: 24,
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
  membersContainer: {
    padding: 16,
  },
  membersList: {
    marginBottom: 20,
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#d9d9d9",
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#00C853",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  memberInitials: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  memberItemContent: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  memberRole: {
    fontSize: 14,
    color: "#AAAAAA",
  },
  memberStatus: {
    fontSize: 12,
    color: "#00C853",
    fontWeight: "bold",
  },
  treesContainer: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00C853",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    marginLeft: 4,
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    color: "#FFFFFF",
    fontSize: 16,
    marginBottom: 8,
  },
  emptySubText: {
    color: "#AAAAAA",
    fontSize: 14,
    textAlign: "center",
  },
  treesList: {
    marginBottom: 20,
  },
  treeItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#333",
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  treeItemContent: {
    flex: 1,
  },
  treeName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  treeSpecies: {
    fontSize: 14,
    color: "#AAAAAA",
  },
  visitButton: {
    backgroundColor: "#00C853",
    borderRadius: 8,
    padding: 16,
    margin: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  visitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  deleteButton: {
    backgroundColor: "#FF5252",
    borderRadius: 8,
    padding: 16,
    margin: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  preloadAllButton: {
    backgroundColor: "#2196F3",
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  preloadAllButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 193, 7, 0.8)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  offlineBannerText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 8,
  },
  collaboratorBadge: {
    backgroundColor: "#2196F3",
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  collaboratorBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  removeButton: {
    backgroundColor: "#FF5252",
    borderRadius: 12,
    padding: 4,
  },
  memberInfo: {
    flex: 1,
  },
  memberActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  ownerBadge: {
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  ownerBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  // Styles pour le modal d'invitation
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#222",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    borderRadius: 8,
    margin: 16,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: "#FFFFFF",
    fontSize: 16,
  },
  searchLoader: {
    marginLeft: 8,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 82, 82, 0.1)",
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  errorBannerText: {
    color: "#FF5252",
    marginLeft: 8,
    fontSize: 14,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  searchResultsContainer: {
    marginBottom: 16,
    maxHeight: 200,
  },
  searchResultsList: {
    maxHeight: 180,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  searchResultEmail: {
    fontSize: 14,
    color: "#AAAAAA",
  },
  selectedUsersContainer: {
    marginBottom: 16,
    maxHeight: 200,
  },
  selectedUsersList: {
    maxHeight: 180,
  },
  selectedUserItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  selectedUserContent: {
    flex: 1,
  },
  selectedUserName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  selectedUserEmail: {
    fontSize: 14,
    color: "#AAAAAA",
  },
  inviteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C853",
    borderRadius: 8,
    padding: 16,
    margin: 16,
  },
  inviteButtonDisabled: {
    backgroundColor: "#444",
  },
  inviteButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  addMemberButton: {
    backgroundColor: "#00C853",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  pendingActionsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 193, 7, 0.9)',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  pendingActionsText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
})

export default ProjectDetailScreen