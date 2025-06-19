"use client"

import { useRef, useEffect, useState, forwardRef } from "react"
import { View, StyleSheet, ActivityIndicator, Text } from "react-native"
import { WebView } from "react-native-webview"
import { useMapTiles } from "./MapTileProvider"
import { isOnline } from "../services/network"

/**
 * Composant de carte avec support hors ligne
 * Utilise OpenStreetMap avec mise en cache des tuiles
 */
const OfflineMapView = forwardRef(
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
    const mapRef = useRef(null)
    const { getTileUrl, isOfflineMode } = useMapTiles()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [mapHtml, setMapHtml] = useState("")
    const [currentMarkers, setCurrentMarkers] = useState([])

    // Exposer les méthodes via la référence
    useEffect(() => {
      if (ref) {
        ref.current = {
          setRegion: (region) => {
            if (mapRef.current) {
              mapRef.current.injectJavaScript(`
                if (window.map) {
                  window.map.setView([${region.latitude}, ${region.longitude}], ${Math.log2(360 / region.longitudeDelta) - 1});
                }
                true;
              `)
            }
          },
          getRegion: () => {
            return initialRegion
          },
        }
      }
    }, [ref, mapRef.current])

    // Mettre à jour les marqueurs lorsqu'ils changent
    useEffect(() => {
      setCurrentMarkers(markers)
      if (mapRef.current && markers.length > 0) {
        console.log("Mise à jour des marqueurs dans OfflineMapView:", markers.length)

        const markersJS = markers.map((marker, index) => {
          const icon = marker.type === "tree" ? "leaf" : "location"
          const color = marker.type === "tree" ? "#00C853" : "#2196F3"

          return {
            id: marker.treeId || `marker-${index}`,
            lat: marker.latitude,
            lng: marker.longitude,
            title: marker.title || "Marqueur",
            description: marker.description || "",
            icon: icon,
            color: color,
          }
        })

        mapRef.current.injectJavaScript(`
          if (window.updateMapMarkers) {
            window.updateMapMarkers(${JSON.stringify(markersJS)});
          } else {
            console.error("La fonction updateMapMarkers n'est pas disponible");
          }
          true;
        `)
      }
    }, [markers])

    // Mettre à jour le type de carte lorsqu'il change
    useEffect(() => {
      if (mapRef.current) {
        mapRef.current.injectJavaScript(`
          if (window.setMapType) {
            window.setMapType("${mapType}");
          }
          true;
        `)
      }
    }, [mapType])

    // Générer le HTML pour la carte OpenStreetMap avec support hors ligne
    useEffect(() => {
      const generateMapHtml = async () => {
        try {
          setLoading(true)
          console.log("Génération du HTML de la carte...")

          // Vérifier si nous sommes en ligne
          const online = await isOnline()

          // Coordonnées initiales
          const { latitude, longitude, latitudeDelta, longitudeDelta } = initialRegion || {
            latitude: 0,
            longitude: 0,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }

          const zoom = Math.log2(360 / longitudeDelta) - 1

          // Créer le HTML pour la carte
          const html = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
              <style>
                html, body, #map {
                  height: 100%;
                  width: 100%;
                  margin: 0;
                  padding: 0;
                }
                .custom-marker {
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  width: 30px;
                  height: 30px;
                  border-radius: 50%;
                  background-color: #00C853;
                  border: 2px solid white;
                  color: white;
                  font-weight: bold;
                  text-align: center;
                }
                .custom-marker.tree {
                  background-color: #00C853;
                }
                .custom-marker.project {
                  background-color: #2196F3;
                }
                .marker-popup {
                  min-width: 150px;
                }
                .marker-title {
                  font-weight: bold;
                  margin-bottom: 5px;
                }
                .marker-description {
                  font-size: 12px;
                }
              </style>
            </head>
            <body>
              <div id="map"></div>
              
              <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
              <script>
                // Initialiser la carte
                var map = L.map('map', {
                  center: [${latitude}, ${longitude}],
                  zoom: ${zoom},
                  zoomControl: ${zoomEnabled},
                  dragging: ${scrollEnabled},
                  touchZoom: ${zoomEnabled},
                  doubleClickZoom: ${zoomEnabled},
                  scrollWheelZoom: false
                });
                
                // Définir les différentes couches de carte
                var standardLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                  attribution: '&copy; OpenStreetMap contributors',
                  maxZoom: 19
                });
                
                var satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                  attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                  maxZoom: 19
                });
                
                // Définir le type de carte initial
                var currentLayer = "${mapType}" === "satellite" ? satelliteLayer : standardLayer;
                currentLayer.addTo(map);
                
                // Fonction pour changer le type de carte
                window.setMapType = function(type) {
                  map.removeLayer(currentLayer);
                  currentLayer = type === "satellite" ? satelliteLayer : standardLayer;
                  currentLayer.addTo(map);
                };
                
                // Stocker les marqueurs
                var mapMarkers = {};
                
                // Fonction pour mettre à jour les marqueurs
                window.updateMapMarkers = function(markers) {
                  console.log("Mise à jour des marqueurs:", markers.length);
                  
                  // Supprimer tous les marqueurs existants
                  Object.values(mapMarkers).forEach(function(marker) {
                    map.removeLayer(marker);
                  });
                  
                  mapMarkers = {};
                  
                  // Ajouter les nouveaux marqueurs
                  markers.forEach(function(marker) {
                    var markerType = marker.icon === "leaf" ? "tree" : "project";
                    var iconHtml = '<div class="custom-marker ' + markerType + '">' + 
                                  (markerType === "tree" ? "🌳" : "📍") + 
                                  '</div>';
                    
                    var customIcon = L.divIcon({
                      html: iconHtml,
                      className: '',
                      iconSize: [30, 30],
                      iconAnchor: [15, 15]
                    });
                    
                    var leafletMarker = L.marker([marker.lat, marker.lng], {
                      icon: customIcon
                    }).addTo(map);
                    
                    // Ajouter un popup
                    var popupContent = '<div class="marker-popup">' +
                                      '<div class="marker-title">' + marker.title + '</div>' +
                                      '<div class="marker-description">' + marker.description + '</div>' +
                                      '</div>';
                    
                    leafletMarker.bindPopup(popupContent);
                    
                    // Ajouter un gestionnaire d'événements pour le clic
                    leafletMarker.on('click', function() {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'markerClick',
                        id: marker.id
                      }));
                    });
                    
                    mapMarkers[marker.id] = leafletMarker;
                  });
                };
                
                // Écouter les événements de la carte
                map.on('moveend', function() {
                  var center = map.getCenter();
                  var zoom = map.getZoom();
                  
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'regionChange',
                    center: {
                      lat: center.lat,
                      lng: center.lng
                    },
                    zoom: zoom
                  }));
                });
                
                map.on('click', function(e) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'mapClick',
                    latlng: {
                      lat: e.latlng.lat,
                      lng: e.latlng.lng
                    }
                  }));
                });
                
                // Signaler que la carte est prête
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'mapReady'
                }));
              </script>
            </body>
            </html>
          `

          setMapHtml(html)
          setLoading(false)
        } catch (err) {
          console.error("[OfflineMapView] Erreur lors de la génération du HTML de la carte:", err)
          setError("Impossible de charger la carte")
          setLoading(false)
        }
      }

      generateMapHtml()
    }, [initialRegion])

    // Gérer les messages de la WebView
    const handleWebViewMessage = async (event) => {
      try {
        const data = JSON.parse(event.nativeEvent.data)
        console.log("Message reçu de la WebView:", data.type)

        if (data.type === "mapReady") {
          console.log("Carte prête, mise à jour des marqueurs...")
          // Mettre à jour les marqueurs une fois que la carte est prête
          if (mapRef.current && currentMarkers.length > 0) {
            const markersJS = currentMarkers.map((marker, index) => {
              const icon = marker.type === "tree" ? "leaf" : "location"
              const color = marker.type === "tree" ? "#00C853" : "#2196F3"

              return {
                id: marker.treeId || `marker-${index}`,
                lat: marker.latitude,
                lng: marker.longitude,
                title: marker.title || "Marqueur",
                description: marker.description || "",
                icon: icon,
                color: color,
              }
            })

            mapRef.current.injectJavaScript(`
              if (window.updateMapMarkers) {
                window.updateMapMarkers(${JSON.stringify(markersJS)});
              }
              true;
            `)

            // Définir le type de carte initial
            mapRef.current.injectJavaScript(`
              if (window.setMapType) {
                window.setMapType("${mapType}");
              }
              true;
            `)
          }
        } else if (data.type === "regionChange") {
          // Signaler le changement de région
          if (onRegionChange) {
            const { center, zoom } = data
            const latitudeDelta = (360 / Math.pow(2, zoom)) * 0.5
            const longitudeDelta = 360 / Math.pow(2, zoom)

            onRegionChange({
              latitude: center.lat,
              longitude: center.lng,
              latitudeDelta,
              longitudeDelta,
            })
          }
        } else if (data.type === "mapClick") {
          // Signaler un clic sur la carte
          if (onPress) {
            onPress({
              nativeEvent: {
                coordinate: {
                  latitude: data.latlng.lat,
                  longitude: data.latlng.lng,
                },
              },
            })
          }
        } else if (data.type === "markerClick") {
          console.log("Clic sur un marqueur:", data.id)
          // Signaler un clic sur un marqueur
          if (onMarkerPress) {
            const marker = currentMarkers.find((m) => m.treeId === data.id)
            if (marker) {
              onMarkerPress(marker)
            }
          }
        }
      } catch (err) {
        console.error("[OfflineMapView] Erreur lors du traitement du message de la WebView:", err)
      }
    }

    if (loading) {
      return (
        <View style={[styles.container, style]}>
          <ActivityIndicator size="large" color="#00C853" />
          <Text style={styles.loadingText}>Chargement de la carte...</Text>
        </View>
      )
    }

    if (error) {
      return (
        <View style={[styles.container, style]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )
    }

    return (
      <View style={[styles.container, style]}>
        <WebView
          ref={mapRef}
          source={{ html: mapHtml }}
          style={styles.webview}
          onMessage={handleWebViewMessage}
          originWhitelist={["*"]}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#00C853" />
            </View>
          )}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent
            console.error("[OfflineMapView] Erreur WebView:", nativeEvent)
            setError("Erreur lors du chargement de la carte")
          }}
        />
        {isOfflineMode && (
          <View style={styles.offlineIndicator}>
            <Text style={styles.offlineText}>Mode hors ligne</Text>
          </View>
        )}
      </View>
    )
  },
)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#222",
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 10,
    textAlign: "center",
  },
  errorText: {
    color: "#FF5252",
    textAlign: "center",
    padding: 20,
  },
  offlineIndicator: {
    position: "absolute",
    bottom: 10,
    left: 10,
    backgroundColor: "rgba(255, 193, 7, 0.8)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  offlineText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "bold",
  },
})

export default OfflineMapView
