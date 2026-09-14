import { requireOptionalNativeModule } from 'expo';

export default requireOptionalNativeModule<{ assetCatalogVersion?: number }>('JourneyDeckKeepsakes');
