/*
  (c) 2021 Open AR Cloud
  This code is licensed under MIT license (see LICENSE.md for details)

  (c) 2024 Nokia
  Licensed under the MIT License
  SPDX-License-Identifier: MIT
*/

/*
  Spatial service discovery: SSD URL, OSCP region, and services at the device location.
*/

import { getSupportedCountries, setSsdUrl, getServicesAtLocation } from '@oarc/ssd-access';
import { get, writable } from 'svelte/store';

import { availableGeoPoseServices, selectedGeoPoseService, ssr } from '../stateStore';

/** Configured SSD base URL, or undefined when VITE_SSD_ROOT_URL is missing. */
function configuredSsdBaseUrl(): string | undefined {
    const ssdUrl = import.meta.env.VITE_SSD_ROOT_URL;
    return ssdUrl != undefined && ssdUrl != '' ? ssdUrl : undefined;
}

let appliedSsdUrl: string | undefined;

/** Point ssd-access at the configured server. Country and service lookups use this URL. */
export function setConfiguredSsdUrl(): void {
    const ssdUrl = configuredSsdBaseUrl();
    if (ssdUrl == undefined) {
        console.error('Cannot determine SSD URL!');
        throw new Error('Cannot determine SSD URL!');
    }
    setSsdUrl(ssdUrl);
    if (appliedSsdUrl !== ssdUrl) {
        appliedSsdUrl = ssdUrl;
        console.log('Setting SSD URL to ' + ssdUrl);
    }
}

/** OSCP region used for service discovery. Independent of the device location. */
export const regionCode = writable('');

/**
 * Region code for service discovery. Nominatim codes are lowercase; SSD country codes are uppercase.
 * Sets the configured SSD URL first. Older SSD servers have no `/countries` route; in that case
 * the Nominatim country is used as the region. A loaded list still falls back to `us` when the country is absent.
 */
export async function regionCodeForCountry(countryCode: string): Promise<string> {
    setConfiguredSsdUrl();
    if (typeof countryCode !== 'string' || countryCode.trim() === '') {
        return 'us';
    }
    try {
        const countries = await getSupportedCountries();
        const supported = countries.some((code) => code.toLowerCase() === countryCode.toLowerCase());
        return supported ? countryCode : 'us';
    } catch (error) {
        console.error('Could not retrieve supported countries from SSD. Using the device country code.', error);
        return countryCode;
    }
}

/**
 * Requests spatial services for an OSCP region and H3 index.
 */
export async function retrieveServicesAtLocation(regionCode: string, h3Index: string): Promise<void> {
    try {
        setConfiguredSsdUrl();
        // TODO: we could also query all the neighboring hexagons
        const services = await getServicesAtLocation(regionCode, h3Index);
        ssr.set(services);

        if (get(availableGeoPoseServices).length > 0 && get(selectedGeoPoseService) == null) {
            selectedGeoPoseService.set(get(availableGeoPoseServices)[0]);
        }

        if (services.length === 0) {
            console.error('No available services found');
        } else {
            console.log('Retrieved ' + services.length + ' SSRs');
        }
    } catch (error) {
        console.error('Could not retrieve spatial services');
        console.error(error);
        throw error;
    }
}
