import { point as turfPoint, lineString } from "@turf/helpers";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import distance from "@turf/distance";
import { TrafficElement } from "../utils/types";

export async function getTrafficRules(
  origin:[number,number],
  destination:[number,number],
  snappedRoute:[number,number][],
  token:string
):Promise<TrafficElement[]>{

  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/`+
    `${origin.join(",")};${destination.join(",")}` +
    `?geometries=geojson&overview=full&steps=true&access_token=${token}`;

  const { routes } = await fetch(url).then(r=>r.json());
  const steps = routes?.[0]?.legs?.[0]?.steps ?? [];

  const raw:TrafficElement[] = [];
  steps.forEach((s,i)=>{
    const loc=s.maneuver?.location;
    const tp = s.maneuver?.type;
    if(!loc||!tp) return;
    if(tp==="roundabout"||tp==="rotary"){
      raw.push({id:`rb-${i}`,type:"roundabout",location:loc as any,radius:30,priorityRule:"give-way"});
    }else if(["merge","fork","turn"].includes(tp)){
      raw.push({id:`y-${i}`,type:"yield",location:loc as any,radius:15,priorityRule:"give-way"});
    }
  });

  // quitar duplicados y snap
  const uniq:TrafficElement[]=[];
  for(const r of raw){
    if(!uniq.some(u=>u.type===r.type &&
        distance(turfPoint(u.location),turfPoint(r.location),{units:"meters"})<10)){
      uniq.push(r);
    }
  }

  const line = lineString(snappedRoute);
  
  return uniq.map(r=>{
    const n = nearestPointOnLine(line,turfPoint(r.location));
    return {...r,location:[n.geometry.coordinates[0],n.geometry.coordinates[1]]};
  });
}
