import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { Camera, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import imageCompression from 'browser-image-compression';

export default function EventForm({ onClose, location, isLocationValid }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState('');
  const [photo, setPhoto] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [error, setError] = useState('');

  const handlePhotoSelect = async () => {
    setIsUploadingPhoto(true);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (file) {
        try {
          const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 800,
            useWebWorker: true,
          };
          const compressedFile = await imageCompression(file, options);
          setPhoto(compressedFile);
        } catch (error) {
          console.error('Erreur lors de la compression de l\'image:', error);
          setError('Erreur lors de la compression de l\'image');
        } finally {
          setIsUploadingPhoto(false);
        }
      } else {
        setIsUploadingPhoto(false);
      }
    };
    input.click();
  };

  const handleDateChange = (event) => {
    const selectedDate = event.target.value;
    setDate(selectedDate);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Le titre est requis');
      return;
    }
    if (!content.trim()) {
      setError('Le contenu est requis');
      return;
    }
    if (!date) {
      setError('La date est requise');
      return;
    }
    if (!location) {
      setError('Veuillez sélectionner un emplacement sur la carte');
      return;
    }
    if (!isLocationValid) {
      setError('L\'emplacement sélectionné doit être à l’intérieur de la Cité Aliou Sow');
      return;
    }

    const selectedDate = new Date(date);
    const now = new Date();
    if (selectedDate < now) {
      setError('La date de l’événement ne peut pas être dans le passé.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      let photoUrl = null;
      if (photo) {
        setIsUploadingPhoto(true);
        const fileName = `${Date.now()}-${photo.name}`;
        const { error: uploadError } = await supabase.storage
          .from('event-photos')
          .upload(fileName, photo);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('event-photos')
          .getPublicUrl(fileName);

        photoUrl = publicUrl;
        setIsUploadingPhoto(false);
      }

      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          title,
          content,
          date: new Date(date).toISOString(),
          location: `${location.lat},${location.lng}`,
          photo_url: photoUrl,
          user_id: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (eventError) throw eventError;

      let successType = 'full';

      try {
        const response = await fetch('https://wdmqrcbqpugngbwqpytz.supabase.co/functions/v1/send-report-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkbXFyY2JxcHVnbmdid3FweXR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI4Nzc5MzksImV4cCI6MjA1ODQ1MzkzOX0.rTwThEgczsKhJBUo6qpABQWFJXqXfrDf3ZV6UYxwudA`,
          },
          body: JSON.stringify({
            type: 'new_event',
            eventId: event.id,
            userEmail: (await supabase.auth.getUser()).data.user?.email,
            title: event.title,
          }),
        });

        if (!response.ok) {
          throw new Error('Échec de l\'envoi de l\'email');
        }
      } catch (emailError) {
        console.error('Erreur lors de l\'envoi de l\'email:', emailError);
        successType = 'partial';
      }

      onClose();
      router.push(`/(tabs)/events?success=${successType}`);
    } catch (error) {
      console.error('Erreur lors de la création de l’événement:', error);
      onClose();
      router.push('/(tabs)/events?success=failed');
    } finally {
      setIsSubmitting(false);
      setIsUploadingPhoto(false);
    }
  };

  const now = new Date();
  const minDateTime = now.toISOString().slice(0, 16);

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <View style={styles.header}>
          <Text style={styles.title}>Nouvel événement</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#666" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.content}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Titre</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Titre de l’événement"
              maxLength={50}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Contenu</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={content}
              onChangeText={setContent}
              placeholder="Description de l’événement (200 caractères max)"
              multiline
              numberOfLines={4}
              maxLength={200}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Date et heure</Text>
            {Platform.OS === 'web' ? (
              <input
                type="datetime-local"
                min={minDateTime}
                value={date}
                onChange={handleDateChange}
                style={styles.dateInput}
              />
            ) : (
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD HH:mm (ex. 2025-04-20 14:00)"
              />
            )}
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Photo (facultatif)</Text>
            <TouchableOpacity
              style={styles.photoButton}
              onPress={handlePhotoSelect}
              disabled={isUploadingPhoto}
            >
              <Camera size={24} color="#666" />
              {isUploadingPhoto ? (
                <ActivityIndicator size="small" color="#666" style={{ marginLeft: 8 }} />
              ) : (
                <Text style={styles.photoButtonText}>
                  {photo ? 'Changer la photo' : 'Ajouter une photo'}
                </Text>
              )}
            </TouchableOpacity>
            {photo && !isUploadingPhoto ? <Text style={styles.photoName}>{photo.name}</Text> : null}
          </View>
          <TouchableOpacity
            style={[styles.submitButton, (isSubmitting || !isLocationValid) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting || !isLocationValid}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Création...' : 'Créer l’événement'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    zIndex: 1000,
    ...(Platform.OS === 'web' && { pointerEvents: 'none' }),
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    maxHeight: '50%',
    marginTop: 50,
    marginRight: 10,
    ...(Platform.OS === 'web' && { pointerEvents: 'auto' }),
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    padding: 20,
  },
  errorText: {
    color: '#dc2626',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  dateInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    width: '100%',
    border: 'none',
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  photoButtonText: {
    color: '#666',
    fontSize: 16,
  },
  photoName: {
    marginTop: 8,
    fontSize: 14,
    color: '#4b5563',
  },
  submitButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});