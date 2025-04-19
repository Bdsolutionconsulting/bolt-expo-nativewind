import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Alert, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Fonction utilitaire pour envoyer une notification email
const sendNotificationEmail = async ({ type, reportId, userEmail, title, status, notificationsEnabled }) => {
  // Si les notifications sont désactivées, ne pas envoyer d'email
  if (!notificationsEnabled) {
    return { skipped: true };
  }

  try {
    const response = await fetch('https://wdmqrcbqpugngbwqpytz.supabase.co/functions/v1/send-report-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkbXFyY2JxcHVnbmdid3FweXR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI4Nzc5MzksImV4cCI6MjA1ODQ1MzkzOX0.rTwThEgczsKhJBUo6qpABQWFJXqXfrDf3ZV6UYxwudA`,
      },
      body: JSON.stringify({
        type,
        reportId,
        userEmail,
        title,
        status,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Erreur lors de l'envoi de l'email: ${errorData.error}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur lors de l’envoi de l’email:', error.message);
    throw error;
  }
};

// Icône pour le marqueur
const reportIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  shadowSize: [41, 41],
});

export default function ReportDetail() {
  const { id } = useLocalSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [report, setReport] = useState(null);
  const [statusHistory, setStatusHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [pendingStatus, setPendingStatus] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true); // Activé par défaut

  // Charger l'état des notifications depuis AsyncStorage
  useEffect(() => {
    const loadNotificationsSetting = async () => {
      try {
        const storedNotifications = await AsyncStorage.getItem('notificationsEnabled');
        if (storedNotifications !== null) {
          setNotificationsEnabled(JSON.parse(storedNotifications));
        }
      } catch (error) {
        console.error('Erreur lors du chargement de l’état des notifications :', error);
      }
    };

    loadNotificationsSetting();
  }, []);

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
    const fetchReportAndHistory = async () => {
      try {
        const { data: reportData, error: reportError } = await supabase
          .from('reports')
          .select(`
            id, title, description, lat, lng, category, photo_url, status, visible, user_id, resolved_by, created_at, updated_at,
            users!user_id(name, email),
            resolved:users!resolved_by(name)
          `)
          .eq('id', id)
          .is('deleted_at', null)
          .single();

        if (reportError) {
          console.error('Erreur lors de la récupération du signalement:', reportError);
          throw reportError;
        }
        if (!reportData) {
          setError('Signalement non trouvé.');
          return;
        }

        setReport(reportData);
        setStatus(reportData.status);

        const { data: historyData, error: historyError } = await supabase
          .from('report_status_history')
          .select(`
            id, old_status, new_status, changed_at, comment,
            changed_by:users!changed_by(name)
          `)
          .eq('report_id', id)
          .order('changed_at', { ascending: false });

        if (historyError) {
          console.error('Erreur lors de la récupération de l\'historique des statuts:', historyError);
          throw historyError;
        }

        setStatusHistory(historyData || []);
      } catch (err) {
        console.error('Erreur lors de la récupération du signalement ou de l\'historique:', err);
        setError('Une erreur est survenue lors de la récupération des données.');
      } finally {
        setLoading(false);
      }
    };

    fetchReportAndHistory();
  }, [id]);

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

  const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');

  const updateStatus = async () => {
    if (!isAdmin) {
      Alert.alert('Erreur', 'Seuls les administrateurs peuvent modifier le statut.');
      return;
    }

    if (!pendingStatus) {
      return;
    }

    setIsUpdating(true);

    try {
      const updates = {
        status: pendingStatus,
        resolved_by: pendingStatus === 'résolu' ? user.id : null,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('reports')
        .update(updates)
        .eq('id', id);

      if (updateError) {
        console.error('Erreur lors de la mise à jour du signalement:', updateError);
        throw updateError;
      }

      const historyEntry = {
        report_id: id,
        old_status: status,
        new_status: pendingStatus,
        changed_by: user.id,
        changed_at: new Date().toISOString(),
        comment: `Statut changé de ${status} à ${pendingStatus} par un administrateur`,
      };

      const { error: historyError } = await supabase
        .from('report_status_history')
        .insert(historyEntry);

      if (historyError) {
        console.error('Erreur lors de l\'insertion dans l\'historique:', historyError);
        throw historyError;
      }

      let emailSuccess = true;
      try {
        await sendNotificationEmail({
          type: 'status_update',
          reportId: id,
          userEmail: report.users.email,
          title: report.title,
          status: pendingStatus,
          notificationsEnabled,
        });
      } catch (emailError) {
        emailSuccess = false;
      }

      const { data: newHistory, error: newHistoryError } = await supabase
        .from('report_status_history')
        .select(`
          id, old_status, new_status, changed_at, comment,
          changed_by:users!changed_by(name)
        `)
        .eq('report_id', id)
        .order('changed_at', { ascending: false });

      if (newHistoryError) {
        console.error('Erreur lors de la récupération de l\'historique mis à jour:', newHistoryError);
        throw newHistoryError;
      }

      setStatusHistory(newHistory || []);
      setStatus(pendingStatus);
      setReport((prev) => ({
        ...prev,
        status: pendingStatus,
        resolved_by: pendingStatus === 'résolu' ? user.id : null,
        resolved: pendingStatus === 'résolu' ? { name: user.name } : null,
        updated_at: updates.updated_at,
      }));
      setPendingStatus(null);

      // Afficher le message selon l'état des notifications et le succès de l'email
      if (emailSuccess || !notificationsEnabled) {
        Alert.alert('Succès', 'Statut mis à jour avec succès !');
      } else {
        Alert.alert('Succès', 'Statut mis à jour, mais l’email n’a pas été envoyé.');
      }
    } catch (err) {
      console.error('Erreur lors de la mise à jour du statut:', err);
      Alert.alert('Erreur', 'Échec de la mise à jour du statut. Veuillez consulter les logs.');
    } finally {
      setIsUpdating(false);
    }
  };

  const selectStatus = (newStatus) => {
    if (newStatus !== status) {
      setPendingStatus(newStatus);
    } else {
      setPendingStatus(null);
    }
  };

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

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{report.title}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.label}>Description :</Text>
        <Text style={styles.text}>{report.description}</Text>
        <Text style={styles.label}>Catégorie :</Text>
        <Text style={styles.text}>{report.category}</Text>
        <Text style={styles.label}>Signalé par :</Text>
        <Text style={styles.text}>{report.users?.name || 'Utilisateur inconnu'}</Text>
        <Text style={styles.label}>Emplacement :</Text>
        <View style={styles.mapContainer}>
          <MapContainer
            center={[report.lat, report.lng]}
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
            <Marker position={[report.lat, report.lng]} icon={reportIcon} />
          </MapContainer>
        </View>
        <Text style={styles.label}>Statut :</Text>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(report.status) }]} />
          <Text style={styles.statusText}>{report.status}</Text>
        </View>
        <Text style={styles.label}>Historique des statuts :</Text>
        {statusHistory.length > 0 ? (
          statusHistory.map((entry) => (
            <View key={entry.id} style={styles.historyEntry}>
              <Text style={styles.historyText}>
                {new Date(entry.changed_at).toLocaleString()} : De "{entry.old_status}" à "{entry.new_status}"
              </Text>
              <Text style={styles.historySubText}>Par : {entry.changed_by?.name || 'Utilisateur inconnu'}</Text>
              {entry.comment && <Text style={styles.historySubText}>Commentaire : {entry.comment}</Text>}
            </View>
          ))
        ) : (
          <Text style={styles.text}>Aucun changement de statut enregistré.</Text>
        )}
        {isAdmin && (
          <>
            <Text style={styles.label}>Changer le statut :</Text>
            <View style={styles.statusButtons}>
              {['signalé', 'en cours', 'résolu'].map((statusOption) => (
                <TouchableOpacity
                  key={statusOption}
                  style={[styles.statusButton, (pendingStatus ? pendingStatus === statusOption : status === statusOption) && styles.statusButtonActive]}
                  onPress={() => selectStatus(statusOption)}
                  disabled={isUpdating}
                >
                  <Text
                    style={[styles.statusButtonText, (pendingStatus ? pendingStatus === statusOption : status === statusOption) && styles.statusButtonTextActive]}
                  >
                    {statusOption.charAt(0).toUpperCase() + statusOption.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {pendingStatus && <TouchableOpacity
              style={[styles.validateButton, isUpdating && styles.validateButtonDisabled]}
              onPress={updateStatus}
              disabled={isUpdating}
            >
              <Text style={styles.validateButtonText}>Valider le changement</Text>
            </TouchableOpacity>}
            {isUpdating && <Text style={styles.updatingText}>Mise à jour en cours...</Text>}
          </>
        )}
        <Text style={styles.label}>Visible :</Text>
        <Text style={styles.text}>{report.visible ? 'Oui' : 'Non'}</Text>
        {report.resolved_by && (
          <>
            <Text style={styles.label}>Résolu par :</Text>
            <Text style={styles.text}>{report.resolved?.name || 'Utilisateur inconnu'}</Text>
          </>
        )}
        <Text style={styles.label}>Date de création :</Text>
        <Text style={styles.text}>{new Date(report.created_at).toLocaleString()}</Text>
        <Text style={styles.label}>Dernière mise à jour :</Text>
        <Text style={styles.text}>{report.updated_at ? new Date(report.updated_at).toLocaleString() : 'Non mis à jour'}</Text>
        {report.photo_url && (
          <>
            <Text style={styles.label}>Photo :</Text>
            <Image source={{ uri: report.photo_url }} style={styles.photo} resizeMode="contain" />
          </>
        )}
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
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    textTransform: 'capitalize',
    color: '#333',
  },
  historyEntry: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
  },
  historyText: {
    fontSize: 14,
    color: '#333',
  },
  historySubText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  statusButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  statusButtonActive: {
    backgroundColor: '#2563eb',
  },
  statusButtonText: {
    color: '#4b5563',
    fontSize: 14,
    fontWeight: '500',
  },
  statusButtonTextActive: {
    color: '#fff',
  },
  validateButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 15,
    alignSelf: 'center',
  },
  validateButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  validateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  updatingText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  photo: {
    width: '100%',
    height: 600,
    marginTop: 10,
    borderRadius: 8,
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