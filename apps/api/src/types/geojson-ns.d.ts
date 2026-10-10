/** Ensure GeoJSON namespace is available even when @types/geojson is not in package types. */
declare namespace GeoJSON {
  type Position = number[];
  interface GeoJsonObject {
    type: string;
    bbox?: number[];
  }
  interface Feature<G extends Geometry | null = Geometry, P = GeoJsonProperties>
    extends GeoJsonObject {
    type: "Feature";
    geometry: G;
    id?: string | number;
    properties: P;
  }
  interface FeatureCollection<G extends Geometry | null = Geometry, P = GeoJsonProperties>
    extends GeoJsonObject {
    type: "FeatureCollection";
    features: Array<Feature<G, P>>;
  }
  type GeoJsonProperties = { [name: string]: unknown } | null;
  type Geometry =
    | Point
    | MultiPoint
    | LineString
    | MultiLineString
    | Polygon
    | MultiPolygon
    | GeometryCollection;
  interface Point extends GeoJsonObject {
    type: "Point";
    coordinates: Position;
  }
  interface MultiPoint extends GeoJsonObject {
    type: "MultiPoint";
    coordinates: Position[];
  }
  interface LineString extends GeoJsonObject {
    type: "LineString";
    coordinates: Position[];
  }
  interface MultiLineString extends GeoJsonObject {
    type: "MultiLineString";
    coordinates: Position[][];
  }
  interface Polygon extends GeoJsonObject {
    type: "Polygon";
    coordinates: Position[][];
  }
  interface MultiPolygon extends GeoJsonObject {
    type: "MultiPolygon";
    coordinates: Position[][][];
  }
  interface GeometryCollection extends GeoJsonObject {
    type: "GeometryCollection";
    geometries: Geometry[];
  }
}
