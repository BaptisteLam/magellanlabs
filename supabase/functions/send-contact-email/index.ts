import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  projectType: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData: ContactFormData = await req.json();
    
    console.log("Received contact form data:", formData);

    // Validation basique
    if (!formData.name || !formData.email || !formData.projectType) {
      return new Response(
        JSON.stringify({ error: "Champs obligatoires manquants" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const emailHtml = `
      <h2>Nouvelle demande de contact - Trinity Studio</h2>
      
      <h3>Informations:</h3>
      <p><strong>Nom:</strong> ${formData.name}</p>
      <p><strong>Email:</strong> ${formData.email}</p>
      ${formData.phone ? `<p><strong>Téléphone:</strong> ${formData.phone}</p>` : ''}
      ${formData.company ? `<p><strong>Entreprise:</strong> ${formData.company}</p>` : ''}
      <p><strong>Type de projet:</strong> ${formData.projectType}</p>
      
      <hr>
      <p><em>Cette demande a été envoyée depuis le formulaire de contact de trinity-studio.fr</em></p>
    `;

    // Utilisation de l'API Resend directement via fetch
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: "Trinity Studio <onboarding@resend.dev>",
        to: ["baptiste.lamidey@icloud.com"],
        reply_to: formData.email,
        subject: `Nouvelle demande de ${formData.name} - ${formData.projectType}`,
        html: emailHtml,
      }),
    });

    const emailResponse = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend API error:', emailResponse);
      throw new Error('Failed to send email. Please try again later.');
    }

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email envoyé avec succès",
        id: emailResponse.id 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-contact-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to send message. Please try again later."
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);