// 브랜치별 배포 위치
def getDeployTargets(envName) {
  targets = [:]

  // dev 브랜치
  targets['dev'] = [[
    SSH_MODE: 'KEYONLY',
    SSH_IP: '192.168.0.241',
    SSH_KEY_ID: '241-login-key',
    COPY_DIR: 'containers/kits-control'
  ]]

    // dev 브랜치
//   targets['prod'] = [[
//     SSH_MODE: 'KEYONLY',
//     SSH_IP: '158.247.210.158',
//     SSH_KEY_ID: 'its-test-key',
//     COPY_DIR: 'containers/kits-control'
//   ]]

  return targets[envName]
}

// 브랜치별 환경 정보
def getBuildBranch(branchName) {
  branches = [
    'origin/dev': 'dev',
    'origin/prod': 'prod',
  ]

  return branches[branchName]
}

// 브랜치별 빌드 명령어
def getBuildCommand(branchName) {
  // 모든 브랜치에서 동일한 빌드 명령어 사용
  return 'pnpm install && pnpm run build:dict && pnpm build'
}

pipeline {
  agent any

  environment {

    BUILD_BRANCH = getBuildBranch(env.GIT_BRANCH)
    BUILD_COMMAND = getBuildCommand(env.GIT_BRANCH)

    // 도커 설정
    DOCKER_IMAGE = ''
    DOCKER_PROJECT_NAME = 'cero'
    DOCKER_IMAGE_NAME = "db-naming-converter"

    SHEET_ID = '1Q98LFRr_Ka1ZyBKUJ6u1vJD67F_JHIs8eovklCX_dNY'
    GID = '593269429'
    XLSX_FILE = 'BMS_테이블_정의_V1.1.xlsx'
    
    // Git, Docker 레지스트리(https://registry.zetra.kr) 로그인 정보 설정
    GIT_KEY_ID = '_github-ssh_deploy@cero-solution.com'
    GIT_REPO_URL = 'https://github.com/CERO-SOLUTION/db-naming-converter.git' // Git 레포지토리 URL
    REGISTRY_URL = 'registry.zetra.kr' // Docker 레지스트리 URL; https는 입력하지 말 것
    REGISTRY_LOGIN_INFO_ID = 'harbor_hjdev'
  }

  stages {
    stage('체크아웃') {
      steps {
        script {
          def BUILD_BRANCH = env.GIT_BRANCH == 'origin/dev' ? 'dev' : 'prod'
          git branch: BUILD_BRANCH, credentialsId: GIT_KEY_ID, url: GIT_REPO_URL
          env.BUILD_BRANCH = BUILD_BRANCH
        }
      }
    }

    stage('이미지 빌드') {
      steps {
        script {
            // DOTENV 파일과 SSH KEY를 가져옴
          // withCredentials([file(credentialsId: BUILD_ENV_ID, variable: 'DOTENV')]) {
          //   writeFile file: '.env.local', text: readFile(DOTENV)
          // }

          // 브랜치에 따라 이미지 이름 변경
          // DOCKER_IMAGE = docker.build("${DOCKER_IMAGE_NAME}-${BUILD_BRANCH}", "-f Dockerfile.${BUILD_BRANCH} --secret id=nextEnv,src=.env.local .")
          DOCKER_IMAGE = docker.build("${DOCKER_PROJECT_NAME}/${DOCKER_IMAGE_NAME}-${BUILD_BRANCH}", "--build-arg BUILD_COMMAND=\"${BUILD_COMMAND}\" .")
        }

        echo "Built: ${DOCKER_IMAGE_NAME}-${BUILD_BRANCH}"
      }
    }

    stage('이미지 전송') {
      steps {
        script {
          // 개발서버 내부 Docker 레지스트리(https://registry.zetra.kr)에 업로드
          docker.withRegistry('https://registry.zetra.kr', REGISTRY_LOGIN_INFO_ID) {
            DOCKER_IMAGE.push(env.BUILD_NUMBER)
            DOCKER_IMAGE.push('latest')
          }
        }

        echo "Pushed: ${DOCKER_IMAGE_NAME}-${BUILD_BRANCH}:${env.BUILD_NUMBER}"
      }
    }

    stage('컨테이너 배포') {
       when {
         expression { BUILD_BRANCH == 'dev' }
       }
      steps {
        script {
          def deployTargets = getDeployTargets(BUILD_BRANCH)
          def deployments = [:]

          // 배포 타깃별로 병렬 배포
          for (item in deployTargets) {
            def target = item

            deployments["TARGET-${BUILD_BRANCH}"] = {
              def remote = [:]
              remote.name = target.SSH_IP
              remote.host = target.SSH_IP
              remote.allowAnyHosts = true

              if (target.SSH_MODE == 'KEYONLY') {
                withCredentials([
                  // DOTENV 파일과 SSH KEY를 가져옴
                  // file(credentialsId: BUILD_ENV_ID, variable: 'DOTENV'),
                  sshUserPrivateKey(credentialsId: target.SSH_KEY_ID, keyFileVariable: 'SSH_PRIVATE_KEY', usernameVariable: 'USERNAME')
                  ]) {
                  // 가져온 키로 ssh 정보 설정
                  remote.user = USERNAME
                  remote.identityFile = SSH_PRIVATE_KEY

                  sshCommand remote: remote, command: """
                    mkdir -p ${target.COPY_DIR}-${BUILD_BRANCH}/
                  """

                  // docker compose 파일 전송
                  sshPut remote: remote, from: "docker-compose.yml", into: "${target.COPY_DIR}-${BUILD_BRANCH}/", failOnError: 'true'

                  // 각 상황에 맞는 .env.* 파일 전송
                  // sshPut remote: remote, from: DOTENV, into: "${target.COPY_DIR}-${BUILD_BRANCH}/.env.local", failOnError: 'true'
                  
                  // 도커 이미지 Pull 및 재시작
                  sshCommand remote: remote, command: """
                    cd ${target.COPY_DIR}-${BUILD_BRANCH}/
                    DOCKER_IMAGE_NAME=${REGISTRY_URL}/${DOCKER_PROJECT_NAME}/${DOCKER_IMAGE_NAME}-${BUILD_BRANCH} DOCKER_CONTAINER_NAME=${DOCKER_IMAGE_NAME}-${BUILD_BRANCH} docker compose pull
                    DOCKER_IMAGE_NAME=${REGISTRY_URL}/${DOCKER_PROJECT_NAME}/${DOCKER_IMAGE_NAME}-${BUILD_BRANCH} DOCKER_CONTAINER_NAME=${DOCKER_IMAGE_NAME}-${BUILD_BRANCH} docker compose up -d
                  """
                }
              }
            }
          }

          parallel deployments
        }
      }
    }
  }
}
