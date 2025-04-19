import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, Animated } from 'react-native';
import { MapContainer, TileLayer, useMap, Marker, Popup, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useLocalSearchParams, router } from 'expo-router';
import ReportForm from '@/components/ReportForm';
import EventForm from '@/components/EventForm';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Définir les limites strictes pour la création (Cité Aliou Sow)
const CREATION_BOUNDS = [
  [14.766540, -17.416938], // Coin sud-ouest
  [14.775257, -17.408352], // Coin nord-est
];

// Définir des limites élargies pour la navigation
const NAVIGATION_BOUNDS = [
  [14.762540, -17.420938], // Coin sud-ouest élargi
  [14.779257, -17.404352], // Coin nord-est élargi
];

// Calculer le centre des limites (identique pour les deux ensembles de limites)
const BOUNDS_CENTER = [
  (CREATION_BOUNDS[0][0] + CREATION_BOUNDS[1][0]) / 2, // Latitude moyenne
  (CREATION_BOUNDS[0][1] + CREATION_BOUNDS[1][1]) / 2, // Longitude moyenne
];

// Icônes personnalisées
const userIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  shadowSize: [41, 41],
});

const reportIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  shadowSize: [41, 41],
});

const eventIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  shadowSize: [41, 41],
});

const markerIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  shadowSize: [41, 41],
});

// Fonction pour calculer la distance entre deux points géographiques (en mètres)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Rayon de la Terre en mètres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance en mètres
};

function MapBounds() {
  const map = useMap();

  useEffect(() => {
    // Centrer la carte sur le centre de BOUNDS par défaut lors du premier rendu
    if (CREATION_BOUNDS) {
      map.setView(BOUNDS_CENTER, 17); // Zoom initial à 17
    }
  }, [map]);

  return null;
}

function LocationPicker({ onLocationSelect, onLocationError }) {
  const map = useMap();
  const markerRef = useRef(null);

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      const boundsLatLng = L.latLngBounds(CREATION_BOUNDS);
      const latLng = L.latLng(lat, lng);

      if (boundsLatLng.contains(latLng)) {
        onLocationSelect({ lat, lng });
        onLocationError(''); // Réinitialiser l'erreur si l'emplacement est valide
        if (markerRef.current) {
          markerRef.current.openPopup();
        }
      } else {
        onLocationSelect(null); // Ne pas accepter l'emplacement hors limites
        onLocationError("Veuillez sélectionner un emplacement à l'intérieur de la Cité Aliou Sow.");
      }
    },
  });

  useEffect(() => {
    const handleMapClick = (e) => {
      const { lat, lng } = e.latlng;
      const boundsLatLng = L.latLngBounds(CREATION_BOUNDS);
      const latLng = L.latLng(lat, lng);

      if (boundsLatLng.contains(latLng)) {
        onLocationSelect({ lat, lng });
        onLocationError('');
        if (markerRef.current) {
          markerRef.current.openPopup();
        }
      } else {
        onLocationSelect(null);
        onLocationError("Veuillez sélectionner un emplacement à l'intérieur de la Cité Aliou Sow.");
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, onLocationSelect, onLocationError]);

  return null;
}

// Composant pour la carte miniature dans la pop-up
function MiniMap({ position }) {
  const miniMapBounds = [
    [position.lat - 0.00045, position.lng - 0.00045], // ~50m autour du point
    [position.lat + 0.00045, position.lng + 0.00045],
  ];

  return (
    <MapContainer
      center={[position.lat, position.lng]}
      zoom={22}
      style={{ height: 200, width: 200 }}
      zoomControl={false}
      dragging={false}
      doubleClickZoom={false}
      scrollWheelZoom={false}
      touchZoom={false}
      maxBounds={miniMapBounds}
      maxBoundsViscosity={1.0}
    >
      <TileLayer
        url="https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=vjq89h7CtoYzO0hcGa0Z"
        attribution='<a href="https://www.maptiler.com/copyright/" target="_blank">© MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>'
        tileSize={512}
        zoomOffset={-1}
        minZoom={1}
        maxZoom={22}
        maxAge={604800}
      />
      <Marker position={[position.lat, position.lng]} icon={reportIcon}>
        <Popup>Emplacement sélectionné</Popup>
      </Marker>
    </MapContainer>
  );
}

export default function MapScreen() {
  const { user } = useAuth();
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [reports, setReports] = useState([]);
  const [events, setEvents] = useState([]);
  const [markers, setMarkers] = useState([]);
  const { mode, refresh } = useLocalSearchParams();
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showSelectionMessage, setShowSelectionMessage] = useState(true); // Gérer l'affichage du message
  const [showReports, setShowReports] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [locationValidationError, setLocationValidationError] = useState('');
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [mapStyle, setMapStyle] = useState('streets-v2'); // Style par défaut
  const mapRef = useRef(null);
  const lastPositionRef = useRef(null); // Pour stocker la dernière position connue
  const fadeAnim = useRef(new Animated.Value(1)).current; // Pour l'animation de clignotement

  // Animation de clignotement
  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, [fadeAnim]);

  // Charger le style de carte depuis AsyncStorage
  const loadMapStyle = async () => {
    try {
      const storedStyle = await AsyncStorage.getItem('mapStyle');
      if (storedStyle) {
        setMapStyle(storedStyle);
      }
    } catch (error) {
      console.error('Erreur lors du chargement du style de carte :', error);
    }
  };

  // Charger le style au montage initial et après redirection si refresh=true
  useEffect(() => {
    loadMapStyle();

    // Si le paramètre refresh est présent, recharger le style
    if (refresh === 'true') {
      loadMapStyle();
      // Nettoyer le paramètre refresh de l'URL pour éviter des rechargements inutiles
      router.replace('/map');
    }
  }, [refresh]);

  // Gérer le mode de sélection de lieu
  useEffect(() => {
    if (mode === 'select-location' || mode === 'select-event-location') {
      setIsSelectingLocation(true);
      setShowSelectionMessage(true); // Réafficher le message à chaque nouvelle sélection
    }
  }, [mode]);

  // Charger les signalements, événements et marqueurs
  useEffect(() => {
    let debounceTimeout;

    const fetchReports = async (retryCount = 3, delay = 1000) => {
      for (let i = 0; i < retryCount; i++) {
        try {
          const { data, error } = await supabase
            .from('reports')
            .select('id, title, description, lat, lng, status, photo_url, user_id, users!user_id(name)')
            .is('deleted_at', null)
            .eq('visible', true)
            .limit(50);

          if (error) {
            throw error;
          }
          setReports(data || []);
          return data || [];
        } catch (err) {
          if (i < retryCount - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            setReports([]);
          }
        }
      }
    };

    const fetchEvents = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, title, content, date, location, photo_url, user_id, users!user_id(name)')
          .is('deleted_at', null)
          .limit(50);

        if (error) {
          return;
        }
        setEvents(data);
      } catch (err) {
        // Gérer l'erreur silencieusement
      }
    };

    const fetchMarkers = async () => {
      try {
        const { data, error } = await supabase
          .from('markers')
          .select('id, title, description, lat, lng, category')
          .is('deleted_at', null)
          .limit(50);

        if (error) {
          return;
        }
        setMarkers(data);
      } catch (err) {
        // Gérer l'erreur silencieusement
      }
    };

    const debouncedFetch = (fetchFn) => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(fetchFn, 500);
    };

    fetchReports();
    fetchEvents();
    fetchMarkers();

    const reportsSubscription = supabase
      .channel('reports_channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'reports' }, 
        () => debouncedFetch(fetchReports)
      )
      .subscribe();

    const eventsSubscription = supabase
      .channel('events_channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'events' }, 
        () => debouncedFetch(fetchEvents)
      )
      .subscribe();

    const markersSubscription = supabase
      .channel('markers_channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'markers' }, 
        () => debouncedFetch(fetchMarkers)
      )
      .subscribe();

    return () => {
      reportsSubscription.unsubscribe();
      eventsSubscription.unsubscribe();
      markersSubscription.unsubscribe();
      clearTimeout(debounceTimeout);
    };
  }, []);

  // Charger les styles de Leaflet
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Suivi en temps réel de la position GPS
  useEffect(() => {
    let watchId;

    const requestLocationPermission = async () => {
      console.log('Début de la demande de géolocalisation...');
      try {
        if (navigator.geolocation) {
          console.log('navigator.geolocation est disponible');

          watchId = navigator.geolocation.watchPosition(
            (position) => {
              console.log('Position reçue:', position);
              const { latitude, longitude } = position.coords;

              // Vérifier la distance par rapport à la dernière position
              if (lastPositionRef.current) {
                const { lat: lastLat, lng: lastLng } = lastPositionRef.current;
                const distance = calculateDistance(lastLat, lastLng, latitude, longitude);
                console.log('Distance déplacée:', distance, 'mètres');

                // Ne mettre à jour que si la distance est supérieure à 10 mètres
                if (distance < 10) {
                  console.log('Déplacement inférieur à 10 mètres, position non mise à jour.');
                  return;
                }
              }

              // Mettre à jour la position
              setLocation({ latitude, longitude });
              setLocationError('');
              lastPositionRef.current = { lat: latitude, lng: longitude };
            },
            (error) => {
              console.error('Erreur de géolocalisation:', error);
              console.log('Code d\'erreur:', error.code, 'Message:', error.message);
              let errorMessage = '';
              if (error.code === error.PERMISSION_DENIED) {
                errorMessage = 'Permission de localisation refusée. Veuillez activer la localisation dans les paramètres de votre appareil.';
                Alert.alert(
                  'Permission de localisation refusée',
                  'Pour afficher votre position sur la carte, veuillez activer la localisation dans les paramètres de votre appareil.',
                  [{ text: 'OK' }]
                );
              } else if (error.code === error.POSITION_UNAVAILABLE) {
                errorMessage = 'Position indisponible. Assurez-vous que le GPS est activé et que vous êtes dans une zone avec une bonne réception.';
              } else if (error.code === error.TIMEOUT) {
                errorMessage = 'Délai de récupération de la position dépassé. Le suivi continue...';
              } else {
                errorMessage = 'Une erreur inconnue est survenue lors de la récupération de la position.';
              }
              setLocationError(errorMessage);
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            }
          );
          console.log('watchPosition démarré, watchId:', watchId);
        } else {
          console.log('navigator.geolocation n\'est PAS disponible');
          setLocationError('La géolocalisation n\'est pas prise en charge par votre navigateur.');
          Alert.alert(
            'Géolocalisation non prise en charge',
            'Votre navigateur ou appareil ne prend pas en charge la géolocalisation.',
            [{ text: 'OK' }]
          );
        }
      } catch (err) {
        console.error('Erreur inattendue lors de la géolocalisation:', err);
        setLocationError('Une erreur inattendue est survenue lors de la récupération de la position.');
      }
    };

    // Activer ou désactiver le suivi GPS selon l'état trackingEnabled
    if (trackingEnabled) {
      requestLocationPermission();
    }

    return () => {
      if (watchId !== undefined) {
        console.log('Nettoyage: arrêt de watchPosition, watchId:', watchId);
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [trackingEnabled]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'signalé':
        return '#ff6b6b';
      case 'en cours':
        return '#ffd93d';
      case 'résolu':
        return '#4CAF50';
      default:
        return '#666';
    }
  };

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    setShowConfirmationModal(true); // Afficher la pop-up de confirmation
    setShowSelectionMessage(false); // Masquer le message après la sélection
  };

  const handleLocationError = (error) => {
    setLocationValidationError(error);
  };

  const handleConfirmLocation = () => {
    setShowConfirmationModal(false);
    if (mode === 'select-location') {
      setShowReportForm(true);
    } else if (mode === 'select-event-location') {
      setShowEventForm(true);
    }
  };

  const handleModifyLocation = () => {
    setShowConfirmationModal(false);
    setSelectedLocation(null); // Permettre une nouvelle sélection
    setShowSelectionMessage(true); // Réafficher le message si l'utilisateur modifie
  };

  const handleCancelSelection = () => {
    setIsSelectingLocation(false);
    setSelectedLocation(null);
    setLocationValidationError('');
    setShowSelectionMessage(false);
    // Redirection vers la page d'origine (reports ou events) sans paramètres
    const targetRoute = mode === 'select-location' ? '/(tabs)/reports' : '/(tabs)/events';
    router.replace(targetRoute);
  };

  const handleCloseReportForm = () => {
    setShowReportForm(false);
    setSelectedLocation(null);
    setLocationValidationError('');
    setShowSelectionMessage(true);
    router.replace('/(tabs)/reports');
  };

  const handleCloseEventForm = () => {
    setShowEventForm(false);
    setSelectedLocation(null);
    setLocationValidationError('');
    setShowSelectionMessage(true);
    router.replace('/(tabs)/events');
  };

  const toggleTracking = () => {
    setTrackingEnabled(!trackingEnabled);
  };

  // Fonction pour masquer le message lors de la navigation sur la carte
  const MapInteractionHandler = () => {
    const map = useMap();

    useEffect(() => {
      const hideMessageOnInteraction = () => {
        setShowSelectionMessage(false);
      };

      map.on('dragstart', hideMessageOnInteraction);
      map.on('zoomstart', hideMessageOnInteraction);

      return () => {
        map.off('dragstart', hideMessageOnInteraction);
        map.off('zoomstart', hideMessageOnInteraction);
      };
    }, [map]);

    return null;
  };

  return (
    <View style={styles.container}>
      {locationError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{locationError}</Text>
        </View>
      ) : null}

      {locationValidationError ? (
        <View style={styles.validationErrorContainer}>
          <Text style={styles.validationErrorText}>{locationValidationError}</Text>
        </View>
      ) : null}

      {isSelectingLocation && !showReportForm && !showEventForm && showSelectionMessage && (
        <Animated.View style={[styles.selectionMessageContainer, { opacity: fadeAnim }]}>
          <Text style={styles.selectionMessageText}>Sélectionnez un lieu sur la carte</Text>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancelSelection}>
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, !showReports && styles.filterButtonInactive]}
          onPress={() => setShowReports(!showReports)}
        >
          <Text style={styles.filterButtonText}>Signalements</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, !showEvents && styles.filterButtonInactive]}
          onPress={() => setShowEvents(!showEvents)}
        >
          <Text style={styles.filterButtonText}>Événements</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, trackingEnabled ? styles.trackingEnabled : styles.trackingDisabled]}
          onPress={toggleTracking}
        >
          <Text style={styles.filterButtonText}>
            {trackingEnabled ? 'Désactiver suivi' : 'Activer suivi'}
          </Text>
        </TouchableOpacity>
      </View>

      <MapContainer
        center={BOUNDS_CENTER}
        zoom={17}
        style={styles.map}
        scrollWheelZoom={true}
        zoomControl={true}
        dragging={true}
        maxZoom={22}
        minZoom={15}
        maxBounds={NAVIGATION_BOUNDS}
        maxBoundsViscosity={0.5}
        ref={mapRef}
      >
        <TileLayer
          url={`https://api.maptiler.com/maps/${mapStyle}/{z}/{x}/{y}.png?key=vjq89h7CtoYzO0hcGa0Z`}
          attribution='<a href="https://www.maptiler.com/copyright/" target="_blank">© MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>'
          tileSize={512}
          zoomOffset={-1}
          minZoom={1}
          maxZoom={22}
          maxAge={604800}
        />
        <MapBounds />
        <MapInteractionHandler /> {/* Gestion des interactions avec la carte */}
        
        {isSelectingLocation && !showReportForm && !showEventForm ? (
          <LocationPicker onLocationSelect={handleLocationSelect} onLocationError={handleLocationError} />
        ) : null}

        {location ? (
          <Marker position={[location.latitude, location.longitude]} icon={userIcon}>
            <Popup>Vous êtes ici !</Popup>
          </Marker>
        ) : null}

        {selectedLocation && !showReportForm && !showEventForm ? (
          <Marker
            position={[selectedLocation.lat, selectedLocation.lng]}
            icon={mode === 'select-location' ? reportIcon : eventIcon}
            ref={(ref) => {
              if (ref) {
                ref.openPopup();
              }
            }}
          >
            <Popup>Emplacement sélectionné</Popup>
          </Marker>
        ) : null}

        <MarkerClusterGroup>
          {showReports &&
            reports.map((report) => (
              <Marker key={report.id} position={[report.lat, report.lng]} icon={reportIcon}>
                <Popup>
                  <div style={{ minWidth: '200px' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold' }}>
                      {report.title}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: getStatusColor(report.status),
                        }}
                      />
                      <span style={{ fontSize: '14px', textTransform: 'capitalize' }}>
                        {report.status}
                      </span>
                    </div>
                    {report.photo_url ? (
                      <img
                        src={report.photo_url}
                        alt="Photo du signalement"
                        style={{
                          width: '100%',
                          height: 'auto',
                          marginTop: "8px",
                          borderRadius: '4px',
                        }}
                      />
                    ) : null}
                    <button
                      style={{
                        marginTop: '10px',
                        padding: '5px 10px',
                        backgroundColor: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                      onClick={() => router.push(`/report/${report.id}`)}
                    >
                      Voir les détails
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
        </MarkerClusterGroup>

        <MarkerClusterGroup>
          {showEvents &&
            events.map((event) => (
              <Marker
                key={event.id}
                position={event.location ? parseLocation(event.location) : [14.7708985, -17.412645]}
                icon={eventIcon}
              >
                <Popup>
                  <div style={{ minWidth: '200px' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold' }}>
                      {event.title}
                    </h3>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
                      Date : {new Date(event.date).toLocaleDateString()}
                    </p>
                    {event.photo_url && (
                      <img
                        src={event.photo_url}
                        alt="Photo de l'événement"
                        style={{
                          width: '100%',
                          height: 'auto',
                          marginTop: '8px',
                          borderRadius: '4px',
                        }}
                      />
                    )}
                    <button
                      style={{
                        marginTop: '10px',
                        padding: '5px 10px',
                        backgroundColor: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                      onClick={() => router.push(`/event/${event.id}`)}
                    >
                      Voir les détails
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
        </MarkerClusterGroup>

        <MarkerClusterGroup>
          {markers.map((marker) => (
            <Marker key={marker.id} position={[marker.lat, marker.lng]} icon={markerIcon}>
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold' }}>
                    {marker.title}
                  </h3>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>{marker.description}</p>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
                    Catégorie : {marker.category}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      {showConfirmationModal && selectedLocation && (
        <Modal visible={true} transparent={true} animationType="fade">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Confirmer l'emplacement</Text>
              <MiniMap position={selectedLocation} />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  onPress={handleModifyLocation}
                  style={styles.modalButton}
                >
                  <Text style={styles.modalButtonText}>Modifier</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirmLocation}
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm]}>
                    Confirmer
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {showReportForm ? (
        <ReportForm 
          onClose={handleCloseReportForm} 
          location={selectedLocation} 
          isLocationValid={selectedLocation && !locationValidationError} 
        />
      ) : null}

      {showEventForm ? (
        <EventForm 
          onClose={handleCloseEventForm} 
          location={selectedLocation} 
          isLocationValid={selectedLocation && !locationValidationError} 
        />
      ) : null}
    </View>
  );
}

const parseLocation = (locationString) => {
  if (!locationString) return [14.7708985, -17.412645];
  const [lat, lng] = locationString.split(',').map(coord => parseFloat(coord.trim()));
  return [lat, lng];
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 10,
  },
  errorContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 250, 0.9)',
    padding: 10,
    borderRadius: 8,
    zIndex: 1000,
  },
  errorText: {
    color: '#ff0000',
    fontSize: 14,
    textAlign: 'center',
  },
  validationErrorContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 10,
    borderRadius: 8,
    zIndex: 1000,
  },
  validationErrorText: {
    color: '#ff0000',
    fontSize: 14,
    textAlign: 'center',
  },
  selectionMessageContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 20,
    borderRadius: 12,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '80%',
  },
  selectionMessageText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ff0000',
    textAlign: 'center',
    marginBottom: 10,
  },
  cancelButton: {
    backgroundColor: '#ff6b6b',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
    zIndex: 1000,
  },
  filterButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  filterButtonInactive: {
    backgroundColor: '#93c5fd',
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  trackingEnabled: {
    backgroundColor: '#2563eb',
  },
  trackingDisabled: {
    backgroundColor: '#ff6b6b',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
    zIndex: 1,
    pointerEvents: 'auto',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    marginHorizontal: 5,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  modalButtonConfirm: {
    backgroundColor: '#2563eb',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  modalButtonTextConfirm: {
    color: '#fff',
  },
});