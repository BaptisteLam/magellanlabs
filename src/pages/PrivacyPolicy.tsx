import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import { useTranslation } from "@/hooks/useTranslation";

const PrivacyPolicy = () => {
  const { t } = useTranslation();

  return (
    <>
      <SEOHead
        title="Privacy Policy"
        description="Trinity Studio privacy policy. Learn how we collect, use and protect your personal data."
        keywords="privacy policy, GDPR, data protection, Trinity Studio"
        canonicalUrl="https://trinity-studio.fr/politique-de-confidentialite"
      />
      <Header />
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <h1 className="text-4xl font-bold mb-8 text-foreground">Privacy Policy</h1>

          <div className="space-y-8 text-foreground/80">
            <section>
              <p className="mb-4">
                <strong>Last updated:</strong> January 10, 2025
              </p>
              <p>
                Trinity Studio is committed to protecting the privacy and security of your personal data. This privacy policy describes how we collect, use and protect your information in accordance with the GDPR.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">1. Data Controller</h2>
              <p>
                <strong>Trinity Studio</strong><br />
                15 Rue de la République<br />
                75011 Paris, France<br />
                Email: contact@trinity-studio.fr<br />
                Phone: +33 6 78 01 57 32
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">2. Data Collected</h2>
              <p className="mb-3">We collect the following information:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Identity data:</strong> last name, first name, company</li>
                <li><strong>Contact data:</strong> email address, phone number</li>
                <li><strong>Browsing data:</strong> IP address, cookies, pages visited</li>
                <li><strong>Project data:</strong> information related to your service request</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">3. Purpose of Processing</h2>
              <p className="mb-3">Your data is used to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Respond to your contact and quote requests</li>
                <li>Manage client relationships and service delivery</li>
                <li>Improve our services and website</li>
                <li>Send you information about our services (with your consent)</li>
                <li>Comply with our legal and regulatory obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">4. Legal Basis for Processing</h2>
              <p className="mb-3">Data processing is based on:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Your consent</li>
                <li>Performance of a contract or pre-contractual measures</li>
                <li>Compliance with a legal obligation</li>
                <li>Our legitimate interest in developing our business</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">5. Data Retention Period</h2>
              <p>
                Your personal data is retained for the duration necessary for the purposes for which it was collected, and in accordance with legal obligations. Contact data is retained for a maximum of 3 years after the last contact. Contractual data is retained for the duration of the contract and then archived in accordance with legal obligations.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">6. Data Recipients</h2>
              <p className="mb-3">Your data may be shared with:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Members of the Trinity Studio team</li>
                <li>Our technical service providers (hosting, maintenance)</li>
                <li>Legal authorities upon justified request</li>
              </ul>
              <p className="mt-3">
                We do not sell or rent your personal data to third parties.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">7. Your Rights</h2>
              <p className="mb-3">In accordance with the GDPR, you have the following rights:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Right of access:</strong> obtain a copy of your data</li>
                <li><strong>Right of rectification:</strong> correct your inaccurate data</li>
                <li><strong>Right to erasure:</strong> delete your data</li>
                <li><strong>Right to restriction:</strong> restrict the processing of your data</li>
                <li><strong>Right to portability:</strong> receive your data in a structured format</li>
                <li><strong>Right to object:</strong> object to the processing of your data</li>
                <li><strong>Right to withdraw your consent</strong> at any time</li>
              </ul>
              <p className="mt-4">
                To exercise your rights, contact us at: <a href="mailto:contact@trinity-studio.fr" className="text-primary hover:underline">contact@trinity-studio.fr</a>
              </p>
              <p className="mt-2">
                You also have the right to file a complaint with the CNIL (French National Commission on Informatics and Liberty).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">8. Cookies</h2>
              <p>
                Our website uses cookies to improve your browsing experience and analyze traffic. You can manage your cookie preferences in your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">9. Data Security</h2>
              <p>
                We implement appropriate technical and organizational measures to protect your data against unauthorized access, loss or alteration. This includes encryption, access controls and regular monitoring of our systems.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">10. Changes</h2>
              <p>
                We reserve the right to modify this privacy policy at any time. Changes will be published on this page with an updated date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">11. Contact</h2>
              <p>
                For any questions regarding this privacy policy, contact us:<br />
                Email: <a href="mailto:contact@trinity-studio.fr" className="text-primary hover:underline">contact@trinity-studio.fr</a><br />
                Phone: <a href="tel:+33678015732" className="text-primary hover:underline">+33 6 78 01 57 32</a>
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default PrivacyPolicy;
