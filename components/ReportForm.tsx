import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { Camera, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import imageCompression from 'browser-image-compression';

export default function ReportForm({ onClose, location, isLocationValid }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [photo, setPhoto] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [error, setError] = useState('');

  const categories = [
    { id: 'Propreté', label: 'Propreté' },
    { id: 'Sécurité', label: 'Sécurité' },
    { id: 'Autre', label: 'Autre' },
  ];

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

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Le titre est requis');
      return;
    }
    if (!description.trim()) {
      setError('La description est requise');
      return;
    }
    if (!category) {
      setError('La catégorie est requise');
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

    setIsSubmitting(true);
    setError('');

    try {
      let photoUrl = null;
      if (photo) {
        setIsUploadingPhoto(true);
        const fileName = `${Date.now()}-${photo.name}`;
        const { error: uploadError } = await supabase.storage
          .from('report-photos')
          .upload(fileName, photo);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('report-photos')
          .getPublicUrl(fileName);

        photoUrl = publicUrl;
        setIsUploadingPhoto(false);
      }

      const { data: report, error: reportError } = await supabase
        .from('reports')
        .insert({
          title,
          description,
          category,
          lat: location.lat,
          lng: location.lng,
          photo_url: photoUrl,
          status: 'signalé',
          visible: true,
          user_id: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (reportError) throw reportError;

      let successType = 'full';

      try {
        const { error: emailError } = await supabase.functions.invoke('send-report-email', {
          body: {
            type: 'new_report',
            reportId: report.id,
            userEmail: (await supabase.auth.getUser()).data.user?.email,
            title: report.title,
          },
        });

        if (emailError) {
          throw new Error('Échec de l\'envoi de l\'email');
        }
      } catch (emailError) {
        console.error('Erreur lors de l\'envoi de l\'email:', emailError);
        successType = 'partial';
      }

      onClose();
      router.push(`/(tabs)/reports?success=${successType}`);
    } catch (error) {
      console.error('Erreur lors de la création du signalement:', error);
      onClose();
      router.push('/(tabs)/reports?success=failed');
    } finally {
      setIsSubmitting(false);
      setIsUploadingPhoto(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <View style={styles.header}>
          <Text style={styles.title}>Nouveau signalement</Text>
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
              placeholder="Titre du signalement"
              maxLength={50}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Description du problème (200 caractères max)"
              multiline
              numberOfLines={4}
              maxLength={200}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Catégorie</Text>
            <View style={styles.categoryContainer}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryButton,
                    category === cat.id && styles.categoryButtonActive,
                  ]}
                  onPress={() => setCategory(cat.id)}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      category === cat.id && styles.categoryButtonTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
              {isSubmitting ? 'Création...' : 'Créer le signalement'}
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
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  categoryButtonActive: {
    backgroundColor: '#2563eb',
  },
  categoryButtonText: {
    color: '#4b5563',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: '#fff',
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