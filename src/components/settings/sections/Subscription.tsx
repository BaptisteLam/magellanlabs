import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CreditCard, Check } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    price: '0€',
    period: '/mois',
    tokens: 1000,
    features: ['1000 tokens/mois', 'Projets illimités', 'Support communautaire'],
  },
  {
    name: 'Pro',
    price: '29€',
    period: '/mois',
    tokens: 10000,
    features: ['10 000 tokens/mois', 'Projets illimités', 'Support prioritaire', 'Analytics avancés'],
    popular: true,
  },
  {
    name: 'Business',
    price: '99€',
    period: '/mois',
    tokens: 50000,
    features: [
      '50 000 tokens/mois',
      'Projets illimités',
      'Support dédié',
      'White label',
      'API access',
    ],
  },
];

export function Subscription() {
  const currentPlan = 'Free';
  const tokensUsed = 450;
  const tokensTotal = 1000;
  const renewalDate = '15 janvier 2025';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Abonnement</h2>
        <p className="text-muted-foreground">Gérez votre plan et votre facturation</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plan actuel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-foreground">{currentPlan}</p>
              <p className="text-sm text-muted-foreground">Date de renouvellement : {renewalDate}</p>
            </div>
            <Badge variant="secondary">{currentPlan}</Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tokens restants</span>
              <span className="font-medium text-foreground">
                {tokensUsed} / {tokensTotal}
              </span>
            </div>
            <Progress value={(tokensUsed / tokensTotal) * 100} />
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-lg font-semibold mb-4 text-foreground">Plans disponibles</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={plan.popular ? 'border-[#03A5C0]/50 shadow-lg shadow-[#03A5C0]/20 rounded-[7px]' : 'rounded-[7px]'}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {plan.popular && <Badge>Populaire</Badge>}
                </div>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  {plan.period}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-[#03A5C0] shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={
                    plan.popular
                      ? 'w-full bg-[#03A5C0]/20 text-[#03A5C0] border border-[#03A5C0]/50 hover:bg-[#03A5C0]/30 rounded-[7px]'
                      : 'w-full rounded-[7px]'
                  }
                  variant={plan.name === currentPlan ? 'secondary' : 'default'}
                  disabled={plan.name === currentPlan}
                >
                  {plan.name === currentPlan ? 'Plan actuel' : 'Mettre à niveau'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Historique des factures
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Aucune facture pour le moment</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
