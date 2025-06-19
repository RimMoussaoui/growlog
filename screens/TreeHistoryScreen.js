"use client"

import { Ionicons } from "@expo/vector-icons"
import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { getHistoryForYear, deleteHistoryEntry } from "../services/historyService"
import AsyncStorage from "@react-native-async-storage/async-storage"
import NetInfo from "@react-native-community/netinfo"

const { width } = Dimensions.get("window")

const TreeHistoryScreen = ({ route, navigation }) => {
  const { treeId, year, treeName, initialEntries = [] } = route.params
  const [historyEntries, setHistoryEntries] = useState(initialEntries)
  const [loading, setLoading] = useState(!initialEntries.length)
  const [error, setError] = useState("")
  const [selectedEntry, setSelectedEntry] = useState(initialEntries[0] || null)
  const [fullscreenImage, setFullscreenImage] = useState(null)
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected && state.isInternetReachable)
    })

    if (initialEntries.length === 0) {
      loadHistoryData()
    }

    return () => {
      unsubscribeNetInfo()
    }
  }, [treeId, year])

  const loadHistoryData = async () => {
    try {
      setLoading(true)
      setError("")
      console.log(`[TreeHistory] Chargement de l'historique pour l'arbre ${treeId}, année ${year}`)

      const entries = await getHistoryForYear(treeId, year)
      console.log(`[TreeHistory] Données reçues de l'API pour l'année ${year}:`, entries)

      if (entries?.length > 0) {
        setHistoryEntries(entries)
        setSelectedEntry(entries[0])
        await AsyncStorage.setItem(`tree_${treeId}_history_${year}`, JSON.stringify(entries))
      } else {
        setError(`Aucune donnée d'historique disponible pour l'année ${year}`)
        setHistoryEntries([])
      }
    } catch (error) {
      console.error("[TreeHistory] Erreur lors du chargement des données historiques:", error)
      setError("Impossible de charger les données historiques")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteHistoryEntry = async (entryToDelete) => {
    if (!isOnline) {
      Alert.alert("Hors ligne", "La suppression n'est pas disponible hors ligne.")
      return
    }

    try {
      console.log(`[TreeHistory] Suppression de l'entrée:`, entryToDelete)

      await deleteHistoryEntry(treeId, entryToDelete.id)

      const cacheKey = `tree_${treeId}_history_${year}`
      const updatedEntries = historyEntries.filter(entry => entry.id !== entryToDelete.id)
      setHistoryEntries(updatedEntries)
      await AsyncStorage.setItem(cacheKey, JSON.stringify(updatedEntries))

      if (selectedEntry?.id === entryToDelete.id) {
        setSelectedEntry(updatedEntries.length > 0 ? updatedEntries[0] : null)
      }

      Alert.alert("Succès", "L'entrée d'historique a été supprimée avec succès")
    } catch (error) {
      console.error("[TreeHistory] Erreur lors de la suppression de l'historique:", error)
      Alert.alert("Erreur", "Impossible de supprimer l'entrée d'historique")
    }
  }

  const getHealthStatusText = (status) => {
    const healthStatuses = {
      good: "Bon",
      fair: "Moyen",
      poor: "Mauvais",
      critical: "Critique",
      dead: "Mort",
      unknown: "Inconnu",
    }
    return healthStatuses[status] || "Inconnu"
  }

  const getHealthStatusColor = (status) => {
    const healthColors = {
      good: "#4CAF50",
      fair: "#FFC107",
      poor: "#FF9800",
      critical: "#F44336",
      dead: "#9E9E9E",
      unknown: "#BDBDBD",
    }
    return healthColors[status] || "#BDBDBD"
  }

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    } catch (error) {
      return "Date invalide"
    }
  }

  const renderHistoryEntry = ({ item, index }) => (
    <TouchableOpacity
      style={[styles.historyEntryCard, selectedEntry?.id === item.id && styles.selectedEntryCard]}
      onPress={() => setSelectedEntry(item)}
    >
      <View style={styles.entryHeader}>
        <Text style={styles.entryDate}>{formatDate(item.date)}</Text>
        {item.isOffline && (
          <View style={styles.offlineBadge}>
            <Ionicons name="cloud-offline" size={16} color="#FFFFFF" />
            <Text style={styles.offlineText}>Hors ligne</Text>
          </View>
        )}
      </View>

      <View style={styles.entryPreview}>
        {item.height && <Text style={styles.previewText}>Hauteur: {item.height}m</Text>}
        {item.diameter && <Text style={styles.previewText}>Diamètre: {item.diameter}cm</Text>}
        {item.oliveQuantity && <Text style={styles.previewText}>Olives: {item.oliveQuantity}kg</Text>}
        {item.oilQuantity && <Text style={styles.previewText}>Huile: {item.oilQuantity}L</Text>}
        {item.health && (
          <View style={[styles.healthBadgeSmall, { backgroundColor: getHealthStatusColor(item.health) }]}>
            <Text style={styles.healthTextSmall}>{getHealthStatusText(item.health)}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )

  const renderImageThumbnail = ({ item, index }) => (
    <TouchableOpacity style={styles.imageThumbnail} onPress={() => setFullscreenImage(item)}>
      <Image source={{ uri: item }} style={styles.thumbnailImage} />
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00C853" />
        <Text style={styles.loadingText}>Chargement de l'historique...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#FF5252" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>
          Historique {year} - {treeName || "Arbre"}
        </Text>
        {!isOnline && (
          <View style={styles.offlineIndicator}>
            <Text style={styles.offlineText}>Hors ligne</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.entriesSection}>
          <Text style={styles.sectionTitle}>Entrées d'historique ({historyEntries.length})</Text>
          <FlatList
            data={historyEntries}
            renderItem={renderHistoryEntry}
            keyExtractor={(item, index) => item.id || `entry-${index}`}
            showsVerticalScrollIndicator={false}
            style={styles.entriesList}
          />
        </View>

        {selectedEntry && (
          <ScrollView style={styles.detailsSection}>
            <View style={styles.detailsHeader}>
              <Text style={styles.detailsTitle}>Détails de l'observation</Text>
              <TouchableOpacity
                style={styles.deleteEntryButton}
                onPress={() => {
                  Alert.alert("Confirmation", "Êtes-vous sûr de vouloir supprimer cette entrée d'historique ?", [
                    { text: "Annuler", style: "cancel" },
                    {
                      text: "Supprimer",
                      style: "destructive",
                      onPress: () => handleDeleteHistoryEntry(selectedEntry),
                    },
                  ])
                }}
              >
                <Ionicons name="trash-outline" size={20} color="#FF5252" />
              </TouchableOpacity>
            </View>

            <View style={styles.detailsContent}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{formatDate(selectedEntry.date)}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Enregistré par</Text>
                <Text style={styles.detailValue}>{selectedEntry.recordedBy || "Utilisateur inconnu"}</Text>
              </View>

              {selectedEntry.height && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Hauteur</Text>
                  <Text style={styles.detailValue}>{selectedEntry.height} m</Text>
                </View>
              )}

              {selectedEntry.diameter && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Diamètre</Text>
                  <Text style={styles.detailValue}>{selectedEntry.diameter} cm</Text>
                </View>
              )}

              {selectedEntry.oliveQuantity && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Quantité d'olives</Text>
                  <Text style={styles.detailValue}>{selectedEntry.oliveQuantity} kg</Text>
                </View>
              )}

              {selectedEntry.oilQuantity && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Quantité d'huile</Text>
                  <Text style={styles.detailValue}>{selectedEntry.oilQuantity} L</Text>
                </View>
              )}

              {selectedEntry.health && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>État de santé</Text>
                  <View style={[styles.healthBadge, { backgroundColor: getHealthStatusColor(selectedEntry.health) }]}>
                    <Text style={styles.healthText}>{getHealthStatusText(selectedEntry.health)}</Text>
                  </View>
                </View>
              )}

              {selectedEntry.notes && (
                <View style={styles.notesSection}>
                  <Text style={styles.detailLabel}>Notes</Text>
                  <View style={styles.notesContainer}>
                    <Text style={styles.notesText}>{selectedEntry.notes}</Text>
                  </View>
                </View>
              )}

              {selectedEntry.observations && selectedEntry.observations.length > 0 && (
                <View style={styles.observationsSection}>
                  <Text style={styles.detailLabel}>Observations</Text>
                  <View style={styles.observationsContainer}>
                    {selectedEntry.observations.map((observation, index) => (
                      <View key={index} style={styles.observationItem}>
                        <Ionicons name="checkmark-circle" size={16} color="#00C853" />
                        <Text style={styles.observationText}>{observation}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {selectedEntry.images && selectedEntry.images.length > 0 && (
                <View style={styles.imagesSection}>
                  <Text style={styles.detailLabel}>Photos ({selectedEntry.images.length})</Text>
                  <FlatList
                    data={selectedEntry.images}
                    renderItem={renderImageThumbnail}
                    keyExtractor={(item, index) => `image-${index}`}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.imagesList}
                  />
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </View>

      <Modal
        animationType="fade"
        transparent={true}
        visible={fullscreenImage !== null}
        onRequestClose={() => setFullscreenImage(null)}
      >
        <View style={styles.fullscreenContainer}>
          <TouchableOpacity style={styles.fullscreenCloseButton} onPress={() => setFullscreenImage(null)}>
            <Ionicons name="close-circle" size={36} color="#FFFFFF" />
          </TouchableOpacity>
          <Image source={{ uri: fullscreenImage }} style={styles.fullscreenImage} resizeMode="contain" />
        </View>
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
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#222",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingBottom: 10,
    backgroundColor: "#c1dbb0"
  },
  offlineIndicator: {
    backgroundColor: '#FF5252',
    padding: 5,
    borderRadius: 4,
  },
  offlineText: {
    color: 'white',
    fontSize: 12,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    flex: 1,
    textAlign: "center",
  },
  content: {
    flex: 1,
    flexDirection: "row",
  },
  entriesSection: {
    flex: 1,
    padding: 16,
    borderRightWidth: 1,
    borderRightColor: "#333",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  entriesList: {
    flex: 1,
  },
  historyEntryCard: {
    backgroundColor: "#c1dbb0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  selectedEntryCard: {
    borderColor: "#00C853",
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  entryDate: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  offlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF9800",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  entryPreview: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  previewText: {
    color: "#FFFFFF",
    fontSize: 12,
    marginRight: 12,
    marginBottom: 4,
  },
  healthBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
  },
  healthTextSmall: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 10,
  },
  detailsSection: {
    flex: 1,
    padding: 16,
  },
  detailsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  deleteEntryButton: {
    padding: 8,
  },
  detailsContent: {
    backgroundColor: "#333",
    borderRadius: 8,
    padding: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#c1dbb0",
  },
  detailLabel: {
    fontSize: 14,
    color: "#999999",
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: "#FFFFFF",
    flex: 2,
    textAlign: "right",
  },
  healthBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  healthText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 12,
  },
  notesSection: {
    marginTop: 8,
  },
  notesContainer: {
    backgroundColor: "#444",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  notesText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
  },
  observationsSection: {
    marginTop: 16,
  },
  observationsContainer: {
    backgroundColor: "#444",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  observationItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  observationText: {
    color: "#FFFFFF",
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  imagesSection: {
    marginTop: 16,
  },
  imagesList: {
    marginTop: 8,
  },
  imageThumbnail: {
    width: 80,
    height: 80,
    marginRight: 8,
    borderRadius: 8,
    overflow: "hidden",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImage: {
    width: "100%",
    height: "80%",
  },
  fullscreenCloseButton: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 10,
  },
  errorText: {
    color: "#FF5252",
    textAlign: "center",
    marginBottom: 20,
    fontSize: 16,
    marginTop: 16,
  },
  backButtonText: {
    color: "#00C853",
    fontSize: 16,
    fontWeight: "500",
  },
})

export default TreeHistoryScreen