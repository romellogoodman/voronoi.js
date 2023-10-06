import {Delaunay} from 'd3-delaunay';
import {MersenneTwister19937, Random} from 'random-js';

const getRandom = (randomSeed) => {
  const seed = randomSeed || MersenneTwister19937.autoSeed();

  return new Random(seed);
};

/**
 * Taken from:
 * https://github.com/d3/d3-polygon/blob/main/src/centroid.js
 */
const centroidOfPoints = (points) => {
  let i = -1;
  let n = points.length;
  let x = 0;
  let y = 0;
  let a;
  let b = points[n - 1];
  let c;
  let k = 0;

  while (++i < n) {
    a = b;
    b = points[i];
    k += c = a[0] * b[1] - b[0] * a[1];
    x += (a[0] + b[0]) * c;
    y += (a[1] + b[1]) * c;
  }

  k *= 3;

  return [x / k, y / k];
};

/**
 * Taken From: https://github.com/georgedoescode/generative-utils/blob/master/src/distToSegment.js
 * - dist2
 * - distanceToSegmentSquared
 * - distanceToSegment
 *
 * Credit Matt DesLauriers: https://gist.github.com/mattdesl/47412d930dcd8cd765c871a65532ffac
 * Taken From: https://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment
 *
 * NOTE: These functions are mostly used in common/voronoi.
 * In the future refactor them to use distanceBetweenTwoPoints and be more composable
 */

const dist2 = (point1, point2) => {
  return (
    Math.pow(point1[0] - point2[0], 2) + Math.pow(point1[1] - point2[1], 2)
  );
};

const distanceToSegmentSquared = (point, startPoint, endPoint) => {
  var l2 = dist2(startPoint, endPoint);
  if (l2 === 0) return dist2(point, startPoint);

  var t =
    ((point[0] - startPoint[0]) * (endPoint[0] - startPoint[0]) +
      (point[1] - startPoint[1]) * (endPoint[1] - startPoint[1])) /
    l2;
  t = Math.max(0, Math.min(1, t));

  return dist2(point, [
    startPoint[0] + t * (endPoint[0] - startPoint[0]),
    startPoint[1] + t * (endPoint[1] - startPoint[1]),
  ]);
};

export const distanceToSegment = (point, startPoint, endPoint) => {
  return Math.sqrt(distanceToSegmentSquared(point, startPoint, endPoint));
};

const sortPointsByAngle = (centroid, points) => {
  const centerPoint = centroid;
  const sorted = points.slice(0);

  const sortByAngle = (p1, p2) => {
    return (
      (Math.atan2(p1[1] - centerPoint[1], p1[0] - centerPoint[0]) * 180) /
        Math.PI -
      (Math.atan2(p2[1] - centerPoint[1], p2[0] - centerPoint[0]) * 180) /
        Math.PI
    );
  };

  sorted.sort(sortByAngle);

  return sorted;
};

const getClosestEdgeToCentroid = (points) => {
  const centroid = centroidOfPoints(points);
  const pointsSorted = sortPointsByAngle(centroid, points);

  let closest = distanceToSegment(centroid, pointsSorted[0], pointsSorted[1]);

  for (let i = 1; i < points.length - 1; i++) {
    if (points[i + 1]) {
      const dist = distanceToSegment(
        centroid,
        pointsSorted[i],
        pointsSorted[i + 1]
      );

      if (dist < closest) {
        closest = dist;
      }
    }
  }

  return closest;
};

const formatCell = (points) => {
  return {
    points,
    innerCircleRadius: getClosestEdgeToCentroid(points),
    centroid: {
      x: centroidOfPoints(points)[0],
      y: centroidOfPoints(points)[1],
    },
  };
};

const defaultOptions = {
  width: 1024,
  height: 1024,
  points: 1024,
  relaxIterations: 8,
};

export const generateVoronoiDiagram = (options) => {
  const random = getRandom(options.seed);

  options = {...defaultOptions, ...options};

  options.points = [...Array(options.points)].map(() => {
    return {
      x: random.integer(0, options.width),
      y: random.integer(0, options.height),
    };
  });

  // options.points = options.points.map((point) => [point.x, point.y]);

  const delaunay = Delaunay.from(options.points);
  const voronoi = delaunay.voronoi([0, 0, options.width, options.height]);

  const diagramPoints = [];

  for (let i = 0; i < delaunay.points.length; i += 2) {
    const x = delaunay.points[i];
    const y = delaunay.points[i + 1];

    diagramPoints.push({
      x,
      y,
    });
  }

  for (let k = 0; k < options.relaxIterations; k++) {
    for (let i = 0; i < delaunay.points.length; i += 2) {
      const cell = voronoi.cellPolygon(i >> 1);

      if (cell === null) continue;

      const x0 = delaunay.points[i];
      const y0 = delaunay.points[i + 1];

      const [x1, y1] = centroidOfPoints(cell);

      delaunay.points[i] = x0 + (x1 - x0) * 1;
      delaunay.points[i + 1] = y0 + (y1 - y0) * 1;
    }

    voronoi.update();
  }

  let cells = [];

  for (let i = 0; i < delaunay.points.length; i += 2) {
    const cell = voronoi.cellPolygon(i >> 1);

    if (cell === null) continue;

    cells.push({
      ...formatCell(cell),
      neighbors: [...voronoi.neighbors(i)].map((index) => {
        return {
          ...formatCell(voronoi.cellPolygon(index)),
        };
      }),
    });
  }

  return {
    cells: cells.map((cell, index) => {
      const neighbors = [...voronoi.neighbors(index)];

      cell.neighbors = neighbors.map((index) => cells[index]);

      return cell;
    }),
    points: diagramPoints,
  };
};
