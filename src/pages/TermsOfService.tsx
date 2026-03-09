import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import { useTranslation } from "@/hooks/useTranslation";

const TermsOfService = () => {
  const { t } = useTranslation();

  return (
    <>
      <SEOHead
        title="Terms of Service"
        description="Trinity Studio terms of service. Review our terms for website creation, development and SEO services."
        keywords="terms of service, general conditions, terms of sale, Trinity Studio, web agency"
        canonicalUrl="https://magellanlabs.com/terms-of-service"
      />
      <Header />
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <h1 className="text-4xl font-bold mb-8 text-foreground">Terms of Sale</h1>
          
          <div className="space-y-8 text-foreground/80">
            <section>
              <p className="mb-4">
                <strong>Last updated:</strong> January 10, 2025
              </p>
              <p>
                These Terms of Sale govern the contractual relationships between Trinity Studio and its clients for the provision of website creation, development, design and SEO services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">1. Identification</h2>
              <p>
                <strong>Trinity Studio</strong><br />
                Website creation and digital development agency<br />
                15 Rue de la République<br />
                75011 Paris, France<br />
                Email: contact@trinity-studio.fr<br />
                Phone: +33 6 78 01 57 32
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">2. Purpose</h2>
              <p>
                The purpose of these Terms of Sale is to define the conditions under which Trinity Studio provides its services to clients, including:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>Website creation (showcase sites, e-commerce, web applications)</li>
                <li>Custom web development and applications</li>
                <li>UI/UX design and visual identity</li>
                <li>Search engine optimization (SEO) services</li>
                <li>Website maintenance and hosting</li>
                <li>Training and support</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">3. Acceptance of Terms</h2>
              <p>
                Any order for services implies unreserved acceptance of these Terms of Sale. Placing an order implies the client's full and unreserved adherence to these terms of sale.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">4. Quotes and Orders</h2>
              <p className="mb-3">
                Every project begins with a detailed, free and non-binding quote. The quote includes:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>A detailed description of the services</li>
                <li>Delivery timelines</li>
                <li>The total price including tax</li>
                <li>Payment terms</li>
                <li>The validity period of the quote (30 days)</li>
              </ul>
              <p className="mt-3">
                The order is confirmed by signing the quote and paying the agreed deposit.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">5. Pricing</h2>
              <p>
                All our prices are quoted in euros and exclude tax, unless otherwise stated. The applicable VAT is that in effect on the date of invoicing. Prices include only the services mentioned in the quote. Any additional services will be subject to a supplementary quote.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">6. Payment Terms</h2>
              <p className="mb-3">Unless otherwise agreed, the payment terms are as follows:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>50% deposit upon signing the quote</li>
                <li>40% upon project validation</li>
                <li>10% upon launch or final delivery</li>
              </ul>
              <p className="mt-3">
                Payments can be made by bank transfer or credit card. Invoices are payable within 30 days of issue. In case of late payment, penalties of 3 times the legal interest rate will be applied, as well as a fixed recovery fee of 40 euros.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">7. Delivery Timelines</h2>
              <p>
                The delivery timelines indicated in the quote are provided as estimates and depend on the client providing all necessary materials (content, images, access, etc.). Trinity Studio commits to respecting these timelines as much as possible, but cannot be held responsible for delays caused by the client or events beyond its control.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">8. Client Obligations</h2>
              <p className="mb-3">The client agrees to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide all necessary materials for the project within the agreed timelines</li>
                <li>Designate a single point of contact for project management</li>
                <li>Approve the various project milestones within the allotted timelines</li>
                <li>Guarantee ownership and usage rights of all provided content</li>
                <li>Comply with payment deadlines</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">9. Intellectual Property</h2>
              <p className="mb-3">
                <strong>9.1 Original Creation:</strong> Trinity Studio retains ownership of all creations until full payment of the agreed price.
              </p>
              <p className="mb-3">
                <strong>9.2 Usage Rights:</strong> After full payment, the client has usage rights for the website or application as defined in the quote.
              </p>
              <p className="mb-3">
                <strong>9.3 Source Code:</strong> The source code remains the property of Trinity Studio, unless otherwise specified in the contract.
              </p>
              <p>
                <strong>9.4 Reference:</strong> Trinity Studio reserves the right to mention the completed project in its portfolio and marketing materials, unless the client explicitly objects.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">10. Warranties</h2>
              <p className="mb-3">
                Trinity Studio guarantees that:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Services will be performed with care and professionalism</li>
                <li>The website will be functional on major modern browsers</li>
                <li>The code will comply with current web standards</li>
                <li>A 30-day warranty period after delivery covers bugs and malfunctions</li>
              </ul>
              <p className="mt-3">
                This warranty does not cover modifications requested by the client after delivery, nor problems caused by third-party interventions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">11. Maintenance and Hosting</h2>
              <p>
                Maintenance and hosting services are subject to separate contracts. In the absence of a maintenance contract, Trinity Studio is not required to provide updates, fixes or interventions after the warranty period.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">12. Termination</h2>
              <p className="mb-3">
                <strong>12.1 By the client:</strong> The client may terminate the contract at any time. Amounts already paid remain the property of Trinity Studio for work already completed.
              </p>
              <p>
                <strong>12.2 By Trinity Studio:</strong> In the event of a serious breach by the client of their obligations (including non-payment or failure to provide necessary materials), Trinity Studio may terminate the contract after a formal notice that has remained without effect for 15 days.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">13. Liability</h2>
              <p>
                Trinity Studio's liability is limited to the amount of services invoiced. Trinity Studio cannot be held liable for indirect damages (loss of revenue, data loss, etc.). The client is solely responsible for the content published on their website.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">14. Force Majeure</h2>
              <p>
                Trinity Studio cannot be held liable for the non-performance of its obligations in the event of force majeure, including strikes, computer failures, third-party service interruptions, natural disasters or any event beyond its control.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">15. Data Protection</h2>
              <p>
                Personal data collected as part of our services is processed in accordance with our <a href="/privacy-policy" className="text-primary hover:underline">Privacy Policy</a> and the GDPR.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">16. Applicable Law and Disputes</h2>
              <p>
                These Terms of Sale are governed by French law. In the event of a dispute, the parties agree to seek an amicable solution before any legal action. Failing agreement, the competent courts shall be those of Paris.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">17. Modification of Terms</h2>
              <p>
                Trinity Studio reserves the right to modify these Terms of Sale at any time. The applicable terms are those in effect on the date of the order.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">18. Contact</h2>
              <p>
                For any questions regarding these Terms of Sale, contact us:<br />
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

export default TermsOfService;
