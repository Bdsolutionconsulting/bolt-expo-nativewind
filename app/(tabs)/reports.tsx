import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, RefreshControl, Modal, Image } from 'react-native';
import { TriangleAlert as AlertTriangle, Trash2 } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
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

// Composant pour le message de succès
const SuccessMessage = ({ message }) => {
  if (!message) return null;
  return (
    <View style={styles.successMessage}>
      <Text style={styles.successText}>{message}</Text>
    </View>
  );
};

// Composant pour le message d'erreur
const ErrorMessage = ({ error }) => {
  if (!error) return null;
  return <Text style={styles.errorText}>{error}</Text>;
};

export default function ReportsScreen() {
  const { user } = useAuth();
  const { success } = useLocalSearchParams();
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(null);
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

  const fetchReports = async (retryCount = 3, delay = 1000) => {
    setError('');
    setRefreshing(true);

    for (let i = 0; i < retryCount; i++) {
      try {
        const { data, error } = await supabase
          .from('reports')
          .select('*, users!user_id(name, email)')
          .is('deleted_at', null)
          .eq('visible', true);

        if (error) {
          throw error;
        }
        setReports(data || []);
        setFilteredReports(data || []);
        return data || [];
      } catch (err) {
        console.error(`Erreur lors du chargement des signalements (tentative ${i + 1}/${retryCount}):`, err);
        if (i < retryCount - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('Échec du chargement des signalements après plusieurs tentatives');
          setError('Échec du chargement des signalements après plusieurs tentatives');
          setReports([]);
          setFilteredReports([]);
        }
      } finally {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchReports();

    const reportsSubscription = supabase
      .channel('reports_channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'reports' }, 
        () => fetchReports()
      )
      .subscribe();

    return () => {
      reportsSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (success) {
      if (success === 'true' || success === 'full') {
        setSuccessMessage('Signalement créé avec succès !');
      } else if (success === 'partial') {
        setSuccessMessage(
          notificationsEnabled
            ? 'Signalement créé, mais l’email n’a pas été envoyé.'
            : 'Signalement créé avec succès !'
        );
      } else if (success === 'failed') {
        setSuccessMessage('Échec de la création du signalement. Veuillez consulter les logs.');
      }
      fetchReports();
      setTimeout(() => {
        setSuccessMessage('');
        router.setParams({ success: undefined });
      }, 3000);
    }
  }, [success, notificationsEnabled]);

  useEffect(() => {
    let filtered = reports;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(report => report.status === statusFilter);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(report => report.category === categoryFilter);
    }

    setFilteredReports(filtered);
  }, [statusFilter, categoryFilter, reports]);

  const handleCreateReport = () => {
    router.push('/(tabs)/map?mode=select-location');
  };

  const handleDeleteReport = async (reportId) => {
    if (!user) {
      setError('Vous devez être connecté pour supprimer un signalement.');
      return;
    }

    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const report = reports.find(r => r.id === reportId);
    const isAuthor = report && report.user_id === user.id;

    if (!isAdmin && !isAuthor) {
      setError('Seuls les administrateurs ou l’auteur du signalement peuvent le supprimer.');
      return;
    }

    setShowDeleteModal(reportId);
  };

  const confirmDelete = async (reportId) => {
    try {
      setIsSubmitting(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Aucune session active. Veuillez vous reconnecter.');
      }

      const { data: reportData, error: fetchError } = await supabase
        .from('reports')
        .select('user_id, deleted_at, title, users!user_id(email)')
        .eq('id', reportId)
        .single();
      if (fetchError) {
        console.error('Erreur lors de la récupération du signalement:', fetchError);
        throw new Error('Erreur lors de la vérification du signalement.');
      }

      const { error: rpcError } = await supabase
        .rpc('delete_report', { p_report_id: reportId });

      if (rpcError) {
        console.error('Erreur RPC:', JSON.stringify(rpcError, null, 2));
        throw new Error(`Erreur lors de la suppression via RPC : ${rpcError.message}`);
      }

      let emailSuccess = true;
      try {
        await sendNotificationEmail({
          type: 'report_deleted',
          reportId: reportId,
          userEmail: reportData.users.email,
          title: reportData.title,
          notificationsEnabled,
        });
      } catch (emailError) {
        emailSuccess = false;
      }

      setReports((prev) => prev.filter((report) => report.id !== reportId));
      setFilteredReports((prev) => prev.filter((report) => report.id !== reportId));
      setSuccessMessage(
        emailSuccess || !notificationsEnabled
          ? 'Signalement supprimé avec succès.'
          : 'Signalement supprimé, mais l’email n’a pas été envoyé.'
      );
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Erreur capturée dans confirmDelete:', err);
      setError(err.message || 'Une erreur est survenue lors de la suppression du signalement.');
    } finally {
      setIsSubmitting(false);
      setShowDeleteModal(null);
    }
  };

  const onRefresh = () => {
    fetchReports();
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

  const statuses = [
    { id: 'all', label: 'Tous' },
    { id: 'signalé', label: 'Signalé' },
    { id: 'en cours', label: 'En cours' },
    { id: 'résolu', label: 'Résolu' },
  ];

  const categories = [
    { id: 'all', label: 'Toutes' },
    { id: 'Propreté', label: 'Propreté' },
    { id: 'Sécurité', label: 'Sécurité' },
    { id: 'Autre', label: 'Autre' },
  ];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Signalements</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.card}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1606166244310-c0cf917bd3c3?q=80&w=1338&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }}
            style={styles.cardImage}
          />
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Soignons notre continueité Aliou Sow</Text>
            <Text style={styles.cardDate}>Defar lou Yakh</Text>
            <Text style={styles.cardText}>
              Informez le voisinage des problèmes de sécurité, propreté, et autres.
            </Text>
          </View>
        </View>
        <SuccessMessage message={successMessage} />
        <ErrorMessage error={error} />
        <TouchableOpacity style={styles.createButton} onPress={handleCreateReport}>
          <AlertTriangle size={24} color="#fff" />
          <Text style={styles.createButtonText}>Nouveau signalement</Text>
        </TouchableOpacity>
        <View style={styles.filterContainer}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Statut</Text>
            <View style={styles.filterButtons}>
              {statuses.map((status) => (
                <TouchableOpacity
                  key={status.id}
                  style={[styles.filterButton, statusFilter === status.id && styles.filterButtonActive]}
                  onPress={() => setStatusFilter(status.id)}
                >
                  <Text
                    style={[styles.filterButtonText, statusFilter === status.id && styles.filterButtonTextActive]}
                  >
                    {status.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Catégorie</Text>
            <View style={styles.filterButtons}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.filterButton, categoryFilter === cat.id && styles.filterButtonActive]}
                  onPress={() => setCategoryFilter(cat.id)}
                >
                  <Text
                    style={[styles.filterButtonText, categoryFilter === cat.id && styles.filterButtonTextActive]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
        {filteredReports.length > 0 ? (
          filteredReports.map((report) => (
            <View key={report.id} style={styles.reportCard}>
              <TouchableOpacity style={styles.reportContent} onPress={() => router.push(`/report/${report.id}`)}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportTitle}>{report.title}</Text>
                  <View style={styles.statusContainer}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(report.status) }]} />
                    <Text style={styles.statusText}>{report.status}</Text>
                  </View>
                </View>
                <Text style={styles.reportDescription}>{report.description}</Text>
                <Text style={styles.reportUser}>Signalé par : {report.users?.name || 'Utilisateur inconnu'}</Text>
                <Text style={styles.reportCategory}>Catégorie : {report.category}</Text>
                <Text style={styles.reportDate}>Créé le : {new Date(report.created_at).toLocaleString()}</Text>
              </TouchableOpacity>
              {user && (user.role === 'admin' || user.role === 'super_admin' || (report.user_id && report.user_id === user.id)) && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteReport(report.id)}
                  disabled={isSubmitting}
                >
                  <Trash2 size={20} color="#ff0000" />
                </TouchableOpacity>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.noReportsText}>Aucun signalement trouvé.</Text>
        )}
      </View>

      {showDeleteModal && (
        <Modal visible={true} transparent={true} animationType="fade">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Confirmer la suppression</Text>
              <Text style={styles.modalText}>
                Êtes-vous sûr de vouloir supprimer ce signalement ? Cette action est irréversible.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  onPress={() => setShowDeleteModal(null)}
                  style={styles.modalButton}
                  disabled={isSubmitting}
                >
                  <Text style={styles.modalButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDelete(showDeleteModal)}
                  style={[styles.modalButton, styles.modalButtonDestructive]}
                  disabled={isSubmitting}
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonTextDestructive]}>
                    Supprimer
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  content: {
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 15,
    position: 'relative',
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.1)',
        }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
          elevation: 3,
        }),
  },
  cardImage: {
    width: '100%',
    height: 200,
  },
  cardContent: {
    padding: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  cardText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 8,
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e7f3e7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  successText: {
    color: '#4CAF50',
    fontSize: 16,
    marginLeft: 10,
  },
  errorText: {
    color: '#dc2626',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
  createButton: {
    backgroundColor: '#ff6b6b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    ...(Platform.OS === 'web'
      ? {
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          ':hover': {
            backgroundColor: '#ff5252',
          },
        }
      : {}),
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  filterContainer: {
    marginBottom: 20,
  },
  filterGroup: {
    marginBottom: 15,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
  },
  filterButtonText: {
    color: '#4b5563',
    fontSize: 14,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.1)',
        }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
          elevation: 3,
        }),
  },
  reportContent: {
    flex: 1,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
  },
  reportDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  reportUser: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  reportCategory: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  reportDate: {
    fontSize: 14,
    color: '#888',
  },
  deleteButton: {
    padding: 8,
  },
  noReportsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
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
    width: Platform.OS === 'web' ? '40%' : '80%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    marginHorizontal: 5,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  modalButtonDestructive: {
    backgroundColor: '#ff6b6b',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  modalButtonTextDestructive: {
    color: '#fff',
  },
});