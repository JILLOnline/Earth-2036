#!/usr/bin/env node
// Read-only, mixed-date, noncanonical capital structure sensitivity.
import {buildAevaValuationBridge} from "./lib/phoenix-aeva-valuation-bridge.mjs";
console.log(JSON.stringify(buildAevaValuationBridge(),null,2));
