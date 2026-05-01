<script lang="ts">
  import { _ } from 'svelte-i18n';
  export let coach_sequence: any;
  export let close_coach_page: () => void;

  // Icons mapping for amenities and design
  const getIcon = (type: string): string => {
    const icons: Record<string, string> = {
      AIR_CONDITION: "fa-snowflake",
      WHEELCHAIR_SPACE: "fa-wheelchair",
      BIKE_SPACE: "fa-bicycle",
      QUIET_ZONE: "fa-volume-mute",
      FAMILY_ZONE: "fa-child",
      INFO_POINT: "fa-info-circle",
      DINING_CAR: "fa-utensils",
      TOILET: "fa-restroom",
      LOW_FLOOR: "fa-wheelchair-alt", // NF
    };
    return icons[type] || "fa-star";
  };

  const getLegendText = (type: string): string => {
    const texts: Record<string, string> = {
      AIR_CONDITION: $_('cs_air_condition', { default: 'Air conditioning' }),
      WHEELCHAIR_SPACE: $_('cs_wheelchair_space', { default: 'Wheelchair space with wheelchair-accessible toilet' }),
      BIKE_SPACE: $_('cs_bike_space', { default: 'Bicycle loading' }),
      QUIET_ZONE: $_('cs_quiet_zone', { default: 'Quiet zone in 1st class' }),
      FAMILY_ZONE: $_('cs_family_zone', { default: 'Family zone' }),
      INFO_POINT: $_('cs_info_point', { default: 'Information' }),
      DINING_CAR: $_('cs_dining_car', { default: 'Restaurant / Catering' }),
      TOILET: $_('cs_toilet', { default: 'Toilet' }),
      LOW_FLOOR: $_('cs_low_floor', { default: 'Low-floor access' }),
      occupancy_low: $_('cs_occupancy_low', { default: 'Low to average occupancy expected' }),
      occupancy_high: $_('cs_occupancy_high', { default: 'High occupancy expected' }),
      occupancy_very_high: $_('cs_occupancy_very_high', { default: 'Very high occupancy expected' }),
      class_1: $_('cs_class_1', { default: '1st class coach' }),
      class_2: $_('cs_class_2', { default: '2nd class coach' })
    };
    return object_has_key(texts, type) ? texts[type] : formatEnum(type);
  };

  function object_has_key(obj: any, key: any): boolean {
      return Object.prototype.hasOwnProperty.call(obj, key);
  }

  const formatEnum = (str: string): string => {
    if (!str) return "";
    return str
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  };

  // Extract unique items for the legend
  let presentAmenities = new Set<string>();
  let presentClasses = new Set<string>();
  let presentOccupancies = new Set<string>();
  
  $: if (coach_sequence && coach_sequence.groups) {
    presentAmenities.clear();
    presentClasses.clear();
    presentOccupancies.clear();
    
    coach_sequence.groups.forEach((group: any) => {
      group.vehicles?.forEach((vehicle: any) => {
        if (vehicle.passenger_class) {
          presentClasses.add(vehicle.passenger_class);
        }
        if (vehicle.occupancy) {
          presentOccupancies.add(vehicle.occupancy);
        }
        vehicle.facilities?.forEach((facility: any) => {
          if (facility.amenity_type) {
            presentAmenities.add(facility.amenity_type);
          }
        });
      });
    });
    
    // Trigger reactivity
    presentAmenities = presentAmenities;
    presentClasses = presentClasses;
    presentOccupancies = presentOccupancies;
  }
</script>

<!-- Add FontAwesome to the head -->
<svelte:head>
  <link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
  />
</svelte:head>

<div class="flex flex-col text-current w-full h-full pb-8">
  <div class="flex-1 mt-4">
    {#if coach_sequence && coach_sequence.groups && coach_sequence.groups.length > 0}
      {@const group = coach_sequence.groups[0]}
      
      <!-- Horizontal Carriages Scroller Section -->
      <div class="bg-gray-100 dark:bg-[#1a1c1e] py-6 w-full max-w-full -mt-4 border-b border-gray-200 dark:border-gray-800">
        <!--<div class="px-4 mb-4 flex items-center text-sm font-medium dark:text-gray-300">
          <i class="fas fa-chevron-left text-xs mr-2"></i>
          <span>Direction of travel {group.destination || "destination"}</span>
        </div>-->

        <div class="overflow-x-auto w-full flex items-end gap-1 px-4 pb-2">
          {#each group.vehicles as vehicle, i}
            <div class="flex-shrink-0 flex flex-col items-center">
              <span class="text-xs mb-1 font-medium">{vehicle.label || vehicle.order + 1}</span>
              <div
                class="w-16 h-10 border-[1.5px] border-current flex items-center justify-between px-2 font-bold 
                {i === 0 ? 'train-nose-line' : 'rounded-lg'} 
                {i === group.vehicles.length - 1 ? 'train-tail-line' : 'rounded-lg'}"
              >
              <div class="text-[10px] flex gap-[2px]">
                {#if vehicle.occupancy === 'HIGH' || vehicle.occupancy === 'VERY_HIGH'}
                  <i class="fas fa-user-friends {vehicle.occupancy === 'VERY_HIGH' ? 'text-red-500' : ''}"></i>
                {:else}
                  <i class="fas fa-user"></i>
                {/if}
              </div>
              <span class="text-sm">
                {vehicle.passenger_class === "FIRST" ? "1" : "2"}
              </span>
            </div>
            <!-- Amenities below carriage -->
            <div class="mt-2 text-xs flex gap-1 justify-center min-h-[16px]">
              {#if vehicle.facilities}
                {#each vehicle.facilities as amenity}
                  {#if amenity.amenity_type === 'LOW_FLOOR'}
                    <span class="font-bold text-[10px]">{$_('cs_nf', { default: 'NF' })}</span>
                  {:else}
                    <i class="fas {getIcon(amenity.amenity_type)}"></i>
                  {/if}
                {/each}
              {/if}
            </div>
          </div>
          {#if i < group.vehicles.length - 1}
            <div class="w-2 h-[2px] bg-current mb-8"></div>
          {/if}
        {/each}
      </div></div>

      <!-- LEGEND -->
      <div class="px-4 mt-6">
        <h3 class="text-base font-bold mb-4">{$_('cs_legend', { default: 'Legend' })}</h3>
        <div class="space-y-3 text-sm">
          
          {#if presentOccupancies.size > 0}
            <div class="flex items-center gap-3">
              <i class="fas fa-user w-5 text-center"></i>
              <span>{getLegendText('occupancy_low')}</span>
            </div>
            <div class="flex items-center gap-3">
              <i class="fas fa-user-friends w-5 text-center"></i>
              <span>{getLegendText('occupancy_high')}</span>
            </div>
            <div class="flex items-center gap-3">
              <i class="fas fa-users w-5 text-center text-red-500"></i>
              <span>{getLegendText('occupancy_very_high')}</span>
            </div>
          {/if}

          {#if presentClasses.has('FIRST')}
            <div class="flex items-center gap-3">
              <span class="w-5 text-center font-bold border border-current text-xs leading-none py-[2px] rounded-sm">1</span>
              <span>{getLegendText('class_1')}</span>
            </div>
          {/if}
          {#if presentClasses.has('SECOND')}
            <div class="flex items-center gap-3">
              <span class="w-5 text-center font-bold border border-current text-xs leading-none py-[2px] rounded-sm">2</span>
              <span>{getLegendText('class_2')}</span>
            </div>
          {/if}

          <!-- Used Amenities -->
          {#each Array.from(presentAmenities) as amenityType}
             <div class="flex items-center gap-3">
                {#if amenityType === 'LOW_FLOOR'}
                  <span class="w-5 text-center font-bold text-xs italic">{$_('cs_nf', { default: 'NF' })}</span>
                {:else}
                  <i class="fas {getIcon(amenityType)} w-5 text-center"></i>
                {/if}
                <span>{getLegendText(amenityType)}</span>
             </div>
          {/each}
          
        </div>
        <div class="mt-6 text-xs text-gray-500">
          {$_('cs_disclaimer', { default: 'All information without guarantee.' })}
        </div>
      </div>

    {:else}
      <div class="p-8 text-center text-gray-500">{$_('cs_no_data', { default: 'No train formation data available.' })}</div>
    {/if}
  </div>
</div>

<style>
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  
  .train-nose-line {
    border-top-left-radius: 20px;
    border-bottom-left-radius: 20px;
    border-top-right-radius: 8px;
    border-bottom-right-radius: 8px;
  }
  
  .train-tail-line {
    border-top-right-radius: 20px;
    border-bottom-right-radius: 20px;
    border-top-left-radius: 8px;
    border-bottom-left-radius: 8px;
  }
</style>