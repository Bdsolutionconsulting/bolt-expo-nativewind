// Setup type definitions for built-in Supabase Runtime APIs
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://linkhooddk.netlify.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  try {
    const supabaseClient = createClient('https://wdmqrcbqpugngbwqpytz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkbXFyY2JxcHVnbmdid3FweXR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI4Nzc5MzksImV4cCI6MjA1ODQ1MzkzOX0.rTwThEgczsKhJBUo6qpABQWFJXqXfrDf3ZV6UYxwudA');
    const { type, reportId, eventId, userEmail, title, status } = await req.json();
    if (!type || !userEmail) {
      throw new Error('Missing required parameters: type and userEmail are required');
    }
    if (type.includes('report') && !reportId) {
      throw new Error('Missing required parameter: reportId is required for report-related types');
    }
    if (type.includes('event') && !eventId) {
      throw new Error('Missing required parameter: eventId is required for event-related types');
    }
    let subject = '';
    let content = '';
    switch(type) {
      case 'new_report':
        subject = 'Nouveau signalement créé';
        content = `
          <h2>Votre signalement a été créé avec succès</h2>
          <p>Titre: ${title}</p>
          <p>Nous vous tiendrons informé des mises à jour de votre signalement.</p>
          <p>Consultez les détails ici : <a href="https://linkhooddk.netlify.app/report/${reportId}">Voir le signalement</a></p>
        `;
        break;
      case 'status_update':
        if (!status) {
          throw new Error('Missing required parameter: status is required for type "status_update"');
        }
        subject = 'Mise à jour du statut de votre signalement';
        content = `
          <h2>Le statut de votre signalement a été mis à jour</h2>
          <p>Titre: ${title}</p>
          <p>Nouveau statut: ${status}</p>
          <p>Consultez les détails ici : <a href="https://linkhooddk.netlify.app/report/${reportId}">Voir le signalement</a></p>
        `;
        break;
      case 'report_deleted':
        subject = 'Signalement supprimé';
        content = `
          <h2>Votre signalement a été supprimé</h2>
          <p>Titre: ${title}</p>
          <p>Ce signalement a été supprimé de notre système.</p>
        `;
        break;
      case 'new_event':
        subject = 'Nouvel événement créé';
        content = `
          <h2>Votre événement a été créé avec succès</h2>
          <p>Titre: ${title}</p>
          <p>Consultez les détails ici : <a href="https://linkhooddk.netlify.app/event/${eventId}">Voir l’événement</a></p>
        `;
        break;
      case 'event_deleted':
        subject = 'Événement supprimé';
        content = `
          <h2>Votre événement a été supprimé</h2>
          <p>Titre: ${title}</p>
          <p>Cet événement a été supprimé de notre système.</p>
        `;
        break;
      default:
        throw new Error('Invalid notification type. Must be "new_report", "status_update", "report_deleted", "new_event", or "event_deleted"');
    }
    // Envoyer l'email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: userEmail,
        subject: subject,
        html: content
      })
    });
    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      throw new Error(`Échec de l’envoi de l’email via Resend: ${errorText}`);
    }
    const resendData = await resendResponse.json();
    console.log('Email envoyé via Resend:', resendData);
    return new Response(JSON.stringify({
      success: true,
      message: 'Email envoyé avec succès'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Erreur dans send-report-email:', error.message);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 400
    });
  }
});