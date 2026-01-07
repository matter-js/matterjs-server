import { attribute, cluster, single } from "@matter/main/model";

@cluster(0x125dfc11)
export class NeoCluster {
    @attribute(0x125d0021, single)
    wattAccumulated?: number;

    @attribute(0x125d0023, single)
    watt?: number;

    @attribute(0x125d0022, single)
    current?: number;

    @attribute(0x125d0024, single)
    voltage?: number;
}
