export function getCreditPresentation(individualCredits: number, corporateCredits: number) {
  const individual = Math.max(0, Number(individualCredits) || 0);
  const corporate = Math.max(0, Number(corporateCredits) || 0);
  if (individual > 0 && corporate > 0) {
    return { total: individual + corporate, message: `${individual} bireysel ve ${corporate} kurumsal ilan hakkınız var.`, href: '/ilan-ver' };
  }
  if (corporate > 0) {
    return { total: corporate, message: `${corporate} kurumsal ilan hakkınız var.`, href: '/hesabim/kurumsal' };
  }
  return { total: individual, message: `${individual} bireysel ilan hakkınız var.`, href: '/ilan-ver' };
}