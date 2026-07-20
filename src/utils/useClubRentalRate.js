import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { toWholeNumber } from './numberUtils';

const CLUB_RENTAL_SERVICE_NAME = 'ค่าเช่าไม้กอล์ฟ';

const normalizeServiceName = (value = '') => String(value).trim().toLowerCase();

const findClubRentalService = (services = []) => {
  const exactMatch = services.find((service) => (
    normalizeServiceName(service.Service_Name) === CLUB_RENTAL_SERVICE_NAME
  ));

  if (exactMatch) return exactMatch;

  return services.find((service) => {
    const name = normalizeServiceName(service.Service_Name);
    return name.includes('ค่าเช่าไม้กอล์ฟ') || name.includes('club rental');
  });
};

function useClubRentalRate() {
  const [clubRentalRate, setClubRentalRate] = useState(0);
  const [clubRentalRateLoading, setClubRentalRateLoading] = useState(true);

  useEffect(() => {
    const servicesQuery = query(
      collection(db, 'service_settings'),
      where('Is_Active', '==', true)
    );

    const unsubscribe = onSnapshot(servicesQuery, (snapshot) => {
      const services = snapshot.docs.map((serviceDoc) => serviceDoc.data());
      const rentalService = findClubRentalService(services);
      setClubRentalRate(toWholeNumber(rentalService?.Price_Rate || 0));
      setClubRentalRateLoading(false);
    }, (error) => {
      console.error('Error listening to golf club rental rate:', error);
      setClubRentalRate(0);
      setClubRentalRateLoading(false);
    });

    return unsubscribe;
  }, []);

  return { clubRentalRate, clubRentalRateLoading };
}

export default useClubRentalRate;
