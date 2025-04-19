import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Platform, RefreshControl, Modal } from 'react-native';
import { Calendar, CheckCircle, Trash2 } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const sendNotificationEmail = async ({ type, eventId, userEmail, title }) => {
  try {
    if (!type || !userEmail) {
      throw new Error('Missing required parameters: type and userEmail are required');
    }
    if (type.includes('event') && (!eventId || eventId.toString().trim() === '')) {
      throw new Error('Invalid or missing eventId: eventId is required and must be a non-empty string for event-related types');
    }

    const response = await supabase.functions.invoke('send-report-email', {
      body: {
        type,
        eventId: eventId.toString(),
        userEmail,
        title,
      },
    });

    if (response.error) {
      throw new Error(`Erreur lors de l'envoi de l'email: ${response.error.message}`);
    }

    return response.data;
  } catch (error) {
    console.error('Erreur lors de l’envoi de l’email:', error.message);
    throw error;
  }
};

const SuccessMessage = ({ message, type }) => {
  if (!message) return null;
  const backgroundColor = type === 'full' ? '#e7f3e7' : type === 'partial' ? '#ffedd5' : '#fee2e2';
  const textColor = type === 'full' ? '#4CAF50' : type === 'partial' ? '#f97316' : '#dc2626';
  return (
    <View style={[styles.successMessage, { backgroundColor }]}>
      {type === 'full' && <CheckCircle size={24} color={textColor} />}
      <Text style={[styles.successText, { color: textColor }]}>{message}</Text>
    </View>
  );
};

const ErrorMessage = ({ error }) => {
  if (!error) return null;
  return <Text style={styles.errorText}>{error}</Text>;
};

export default function EventsScreen() {
  const { user, loading } = useAuth();
  const { success } = useLocalSearchParams();
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [dateFilter, setDateFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [successType, setSuccessType] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(null);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  if (!user) {
    router.replace('/sign-in');
    return null;
  }

  const fetchEvents = async (retryCount = 3, delay = 1000) => {
    setError('');
    setRefreshing(true);

    for (let i = 0; i < retryCount; i++) {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*, users!user_id(name, email)')
          .is('deleted_at', null);

        if (error) {
          throw error;
        }
        setEvents(data || []);
        setFilteredEvents(data || []);
        return data || [];
      } catch (err) {
        console.error(`Erreur lors du chargement des événements (tentative ${i + 1}/${retryCount}):`, err);
        if (i < retryCount - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('Échec du chargement des événements après plusieurs tentatives');
          setError('Échec du chargement des événements après plusieurs tentatives');
          setEvents([]);
          setFilteredEvents([]);
        }
      } finally {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchEvents();

    const eventsSubscription = supabase
      .channel('events_channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'events' },
        () => fetchEvents()
      )
      .subscribe();

    return () => {
      eventsSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (success) {
      if (success === 'full') {
        setSuccessMessage('Événement créé avec succès et email envoyé !');
        setSuccessType('full');
      } else if (success === 'partial') {
        setSuccessMessage('Événement créé, mais l’email n’a pas été envoyé.');
        setSuccessType('partial');
      } else if (success === 'failed') {
        setSuccessMessage('Échec de la création de l’événement. Veuillez consulter les logs.');
        setSuccessType('failed');
      }
      fetchEvents();
      setTimeout(() => {
        setSuccessMessage('');
        setSuccessType('');
        router.setParams({ success: undefined });
      }, 3000);
    }
  }, [success]);

  useEffect(() => {
    let filtered = events;

    if (dateFilter === 'upcoming') {
      const now = new Date();
      filtered = filtered.filter(event => new Date(event.date) >= now);
    } else if (dateFilter === 'past') {
      const now = new Date();
      filtered = filtered.filter(event => new Date(event.date) < now);
    }

    setFilteredEvents(filtered);
  }, [dateFilter, events]);

  const handleCreateEvent = () => {
    router.push('/(tabs)/map?mode=select-event-location');
  };

  const handleDeleteEvent = async (eventId) => {
    if (!user) {
      setError('Vous devez être connecté pour supprimer un événement.');
      return;
    }

    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const event = events.find(e => e.id === eventId);
    const isAuthor = event && event.user_id === user.id;

    if (!isAdmin && !isAuthor) {
      setError('Seuls les administrateurs ou l’auteur de l’événement peuvent le supprimer.');
      return;
    }

    console.log('eventId dans handleDeleteEvent:', eventId);

    setShowDeleteModal(eventId);
  };

  const confirmDelete = async (eventId) => {
    try {
      setIsSubmitting(true);

      if (!eventId || eventId.toString().trim() === '') {
        throw new Error('ID de l’événement manquant ou invalide. Impossible de procéder à la suppression.');
      }

      console.log('eventId dans confirmDelete:', eventId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Aucune session active. Veuillez vous reconnecter.');
      }

      const { data: eventData, error: fetchError } = await supabase
        .from('events')
        .select('user_id, deleted_at, title, users!user_id(email)')
        .eq('id', eventId)
        .single();
      if (fetchError) {
        console.error('Erreur lors de la récupération de l’événement:', fetchError);
        throw new Error('Erreur lors de la vérification de l’événement.');
      }

      const { error: rpcError } = await supabase
        .rpc('delete_event', { p_event_id: eventId });

      if (rpcError) {
        console.error('Erreur RPC:', JSON.stringify(rpcError, null, 2));
        throw new Error(`Erreur lors de la suppression via RPC : ${rpcError.message}`);
      }

      if (!eventData?.users?.email || !eventData?.title) {
        throw new Error('Données de l’événement incomplètes pour envoyer la notification.');
      }

      await sendNotificationEmail({
        type: 'event_deleted',
        eventId: eventId,
        userEmail: eventData.users.email,
        title: eventData.title,
      });

      setEvents((prev) => prev.filter((event) => event.id !== eventId));
      setFilteredEvents((prev) => prev.filter((event) => event.id !== eventId));
      setSuccessMessage('Événement supprimé avec succès.');
      setSuccessType('full');
      setTimeout(() => {
        setSuccessMessage('');
        setSuccessType('');
      }, 3000);
    } catch (err) {
      console.error('Erreur capturée dans confirmDelete:', err);
      setError(err.message || 'Une erreur est survenue lors de la suppression de l’événement.');
    } finally {
      setIsSubmitting(false);
      setShowDeleteModal(null);
    }
  };

  const onRefresh = () => {
    fetchEvents();
  };

  const dateFilters = [
    { id: 'all', label: 'Tous' },
    { id: 'upcoming', label: 'À venir' },
    { id: 'past', label: 'Passés' },
  ];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Événements</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.card}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1665400808116-f0e6339b7e9a?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }}
            style={styles.cardImage}
          />
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Fêtes de la cité Aliou Sow</Text>
            <Text style={styles.cardDate}>Nio ko Bokk</Text>
            <Text style={styles.cardText}>
              Informez le voisinage de vos évenements! Comme vos : mariages, batptêmes, anniversaires, conférences, ...
            </Text>
          </View>
        </View>

        <SuccessMessage message={successMessage} type={successType} />
        <ErrorMessage error={error} />
        <TouchableOpacity style={styles.createButton} onPress={handleCreateEvent}>
          <Calendar size={24} color="#fff" />
          <Text style={styles.createButtonText}>Nouvel événement</Text>
        </TouchableOpacity>
        <View style={styles.filterContainer}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Date</Text>
            <View style={styles.filterButtons}>
              {dateFilters.map((filter) => (
                <TouchableOpacity
                  key={filter.id}
                  style={[styles.filterButton, dateFilter === filter.id && styles.filterButtonActive]}
                  onPress={() => setDateFilter(filter.id)}
                >
                  <Text
                    style={[styles.filterButtonText, dateFilter === filter.id && styles.filterButtonTextActive]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
        {filteredEvents.length > 0 ? (
          filteredEvents.map((event) => (
            <View key={event.id} style={styles.card}>
              <TouchableOpacity onPress={() => router.push(`/event/${event.id}`)}>
                <Image
                  source={{
                    uri: event.photo_url || 'https://images.pexels.com/photos/226737/pexels-photo-226737.jpeg',
                  }}
                  style={styles.cardImage}
                />
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{event.title}</Text>
                  <Text style={styles.cardDate}>{new Date(event.date).toLocaleString()}</Text>
                  <Text style={styles.cardText}>{event.content}</Text>
                  <Text style={styles.cardUser}>Par {event.users?.name || 'Anonyme'}</Text>
                </View>
              </TouchableOpacity>
              {user && (user.role === 'admin' || user.role === 'super_admin' || (event.user_id && event.user_id === user.id)) && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteEvent(event.id)}
                  disabled={isSubmitting}
                >
                  <Trash2 size={20} color="#ff0000" />
                </TouchableOpacity>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.noEventsText}>Aucun événement trouvé.</Text>
        )}
      </View>

      {showDeleteModal && (
        <Modal visible={true} transparent={true} animationType="fade">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Confirmer la suppression</Text>
              <Text style={styles.modalText}>
                Êtes-vous sûr de vouloir supprimer cet événement ? Cette action est irréversible.
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
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  successText: {
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
    backgroundColor: '#4CAF50',
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
            backgroundColor: '#45a049',
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
  cardUser: {
    fontSize: 14,
    color: '#888',
  },
  deleteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
  },
  noEventsText: {
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