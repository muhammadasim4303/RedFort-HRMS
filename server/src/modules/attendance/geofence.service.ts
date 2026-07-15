import { Injectable } from '@nestjs/common';

@Injectable()
export class GeofenceService {
  calculateDistanceInMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const dLat = (lat2 - lat1) * (Math.PI / 180.0);
    const dLon = (lon2 - lon1) * (Math.PI / 180.0);
    const rLat1 = lat1 * (Math.PI / 180.0);
    const rLat2 = lat2 * (Math.PI / 180.0);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) *
        Math.sin(dLon / 2) *
        Math.cos(rLat1) *
        Math.cos(rLat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return 6371000.0 * c; // Earth's radius in meters
  }

  isWithinRadius(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
    radiusInMeters: number,
  ): boolean {
    const distance = this.calculateDistanceInMeters(lat1, lon1, lat2, lon2);
    return distance <= radiusInMeters;
  }
}
