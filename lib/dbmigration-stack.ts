import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambda_python from '@aws-cdk/aws-lambda-python-alpha';
import * as path from 'path';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { AuroraPostgresEngineVersion, ClusterInstance, DatabaseCluster, DatabaseClusterEngine } from 'aws-cdk-lib/aws-rds';
import { InterfaceVpcEndpointAwsService, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { CustomResource } from 'aws-cdk-lib';

export class DbmigrationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, 'db-migration-vpc', {
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'isolated',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: InterfaceVpcEndpointAwsService.SECRETS_MANAGER
    });

    const db = new DatabaseCluster(this, 'DbMigrationAuroraCluster', {
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_15_7,
      }),
      serverlessV2MinCapacity: 0,
      serverlessV2MaxCapacity: 2,
      writer: ClusterInstance.serverlessV2('writer'),
      readers: undefined,
      enableDataApi: true,
      iamAuthentication: false,
      storageEncrypted: true,
      vpc,
      vpcSubnets: vpc.selectSubnets({
        subnetType: SubnetType.PRIVATE_ISOLATED,
      }),
      clusterIdentifier: 'db-migration-aurora-cluster',
      defaultDatabaseName: 'db_migration',
      credentials: {
        username: 'postgres',
      },
    });

    const dbSecret = db.secret!;

    const handler = new lambda_python.PythonFunction(this, 'dbMigrationFunction', {
      functionName: 'db-migration-function',
      runtime: lambda.Runtime.PYTHON_3_11,
      entry: path.join(__dirname, 'lambda-functions', 'db_migration'),
      handler: 'lambda_handler',
      vpc: vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
      environment: {
        DB_SECRET_NAME: dbSecret.secretArn,
      },
      timeout: cdk.Duration.seconds(300)
    });
    db.connections.allowDefaultPortFrom(handler);
    dbSecret.grantRead(handler);

    const provider = new Provider(this, "Provider", {
      onEventHandler: handler,
    });

    new CustomResource(this, "Custom::Migration", {
      serviceToken: provider.serviceToken,
      properties: { DummyValue: Date.now().toString() }, // ダミーのプロパティを設定してリソースの更新をトリガー
    });
  }
}
