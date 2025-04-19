import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

// Icône pour le marqueur
const eventIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  shadowSize: [41, 41],
});

export default function EventDetail() {
  const { eventId } = useLocalSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Charger les styles Leaflet pour le web
  useEffect(() => {
    if (Platform.OS === 'web') {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);

      return () => {
        document.head.removeChild(link);
      };
    }
  }, []);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select(`
            id, title, content, date, location, photo_url, user_id, created_at,
            users!user_id(name, email)
          `)
          .eq('id', eventId)
          .is('deleted_at', null)
          .single();

        if (eventError) {
          console.error('Erreur lors de la récupération de l’événement:', eventError);
          throw eventError;
        }
        if (!eventData) {
          setError('Événement non trouvé.');
          return;
        }

        setEvent(eventData);
      } catch (err) {
        console.error('Erreur lors de la récupération de l’événement:', err);
        setError('Une erreur est survenue lors de la récupération des données.');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  if (authLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Chargement de l'utilisateur...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Vous devez être connecté pour voir cette page.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const parseLocation = (locationString) => {
    if (!locationString) return [14.7708985, -17.412645];
    const [lat, lng] = locationString.split(',').map(coord => parseFloat(coord.trim()));
    return [lat, lng];
  };

  const [lat, lng] = parseLocation(event.location);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{event.title}</Text>
      </View>
      <View style={styles.content}>
        {event.photo_url && (
          <>
            <Text style={styles.label}>Photo :</Text>
            <Image source={{ uri: event.photo_url }} style={styles.photo} resizeMode="contain" />
          </>
        )}
        <Text style={styles.label}>Contenu :</Text>
        <Text style={styles.text}>{event.content}</Text>
        <Text style={styles.label}>Date :</Text>
        <Text style={styles.text}>{new Date(event.date).toLocaleString()}</Text>
        <Text style={styles.label}>Créé par :</Text>
        <Text style={styles.text}>{event.users?.name || 'Utilisateur inconnu'}</Text>
        <Text style={styles.label}>Emplacement :</Text>
        <View style={styles.mapContainer}>
          <MapContainer
            center={[lat, lng]}
            zoom={18}
            style={styles.miniMap}
            dragging={false}
            zoomControl={false}
            scrollWheelZoom={false}
            doubleClickZoom={false}
            touchZoom={false}
            boxZoom={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <Marker position={[lat, lng]} icon={eventIcon} />
          </MapContainer>
        </View>
        <Text style={styles.label}>Date de création :</Text>
        <Text style={styles.text}>{new Date(event.created_at).toLocaleString()}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2563eb',
    marginRight: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    elevation: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginTop: 10,
  },
  text: {
    fontSize: 16,
    color: '#333',
    marginTop: 5,
  },
  photo: {
    width: '100%',
    height: 600,
    marginTop: 10,
    borderRadius: 8,
  },
  mapContainer: {
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden',
    height: 200,
  },
  miniMap: {
    height: '100%',
    width: '100%',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#ff0000',
    textAlign: 'center',
    marginTop: 20,
  },
  backButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
    alignSelf: 'center',
  },
});