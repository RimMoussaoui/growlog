"use client"

import { useEffect, useState, forwardRef } from "react"
import { View, StyleSheet, Text } from "react-native"
import OfflineMapView from "./OfflineMapView"
import { useMapTiles } from "./MapTileProvider"
import { isOnline } from "../services/network"

/**
 * Composant de carte qui utilise OfflineMapView pour afficher une carte avec support hors ligne
 */
const MapComponent = forwardRef(
  (
    {
      initialRegion,
      markers = [],
      onRegionChange,
      onPress,
      onMarkerPress,
      style,
      showsUserLocation = false,
      zoomEnabled = true,
      scrollEnabled = true,
      rotateEnabled = true,
      mapType = "standard", // Nouveau paramètre pour le type de carte
      children,
    },
    ref,
  ) => {
    const { isOfflineMode } = useMapTiles()
    const [networkStatus, setNetworkStatus] = useState(true)

    // Vérifier l'état du réseau périodiquement
    useEffect(() => {
      const checkNetwork = async () => {
        const online = await isOnline()
        setNetworkStatus(online)
      }

      checkNetwork()

      const interval = setInterval(checkNetwork, 10000)

      return () => clearInterval(interval)
    }, [])

    // Log pour le débogage
    useEffect(() => {
      console.log("MapComponent - Marqueurs reçus:", markers.length)
      if (markers.length > 0) {
        console.log("Premier marqueur:", markers[0])
      }
    }, [markers])

    // Log pour le débogage
    useEffect(() => {
      console.log("MapComponent - Affichage de la position utilisateur:", showsUserLocation)
    }, [showsUserLocation])

    return (
      <View style={[styles.container, style]}>
        <OfflineMapView
          ref={ref}
          initialRegion={initialRegion}
          markers={markers}
          onRegionChange={onRegionChange}
          onPress={onPress}
          onMarkerPress={onMarkerPress}
          showsUserLocation={showsUserLocation}
          zoomEnabled={zoomEnabled}
          scrollEnabled={scrollEnabled}
          rotateEnabled={rotateEnabled}
          mapType={mapType} // Passer le type de carte
        />

        {children}

        {!networkStatus && (
          <View style={styles.offlineIndicator}>
            <Text style={styles.offlineText}>Mode hors ligne - Cartes limitées</Text>
          </View>
        )}
      </View>
    )
  },
)

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  offlineIndicator: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: "rgba(255, 193, 7, 0.8)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    alignItems: "center",
  },
  offlineText: {
    color: "#000000",
    fontWeight: "bold",
    fontSize: 12,
  },
})

export default MapComponent
