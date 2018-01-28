# CSC519-Project - Milestone 2
Shared repo for CSC519 Devops project

## Screencast videos
1. [Initial setup of Jenkins and jobs + Code Coverage of iTrust](https://youtu.be/VJ59JBodJAw)
2. [iTrust Fuzzing demo](https://youtu.be/RjVnMZLPgZo) 
     - [Automatic pushing demo](https://youtu.be/jZfE_re3Yao)
3. [Checkbox.io Analysis demo](https://youtu.be/qQTq3GTAyDM)

## Organization of this branch

- `ansible/` = contains all the ansible scripts
- `ansible/milestone2.yml` = To setup the entire Milestone 2 (Instructions below)
- `ansible/setupiTrust.yml` = To setup the iTrust code coverage and Fuzzer
- `ansible/setupCheckbox.yml` = To setup the Checkbox code analysis and run a build again server-side code
- `ansible/roles/iTrustFuzzing/templates/fuzz.js.j2` = Contains the fuzzer code
- `ansible/roles/iTrustFuzzing/files/UselessTests.java` = Useless test detector program
- `builds/` = Contains the output of 100 fuzzer runs that includes logs and useless test case results
- `builds/100/uselessTests.txt` = Contains the useless test cases detected. Generated based on 100 builds

## Environment required to run the project
    - Ubuntu 16.04 x64 (Desktop Edition) – running natively
    - Ansible 2.4.0.0 installed
    - Cloned Github repo – m2 branch
    
## Instructions to run the project
    git clone https://github.ncsu.edu/dmolugu/CSC519-Project.git
    cd CSC519-Project
    git checkout m2
    cd ansible

    # Export GIT_ID and GIT_TOKEN
    export GIT_ID=<Unity ID>
    export GIT_TOKEN=<Personal access token>

### Cloned repo for iTrust used in this project
    https://github.ncsu.edu/dmolugu/iTrust-v23.git

### To setup complete jenkins Environment with checkbox and iTrust jobs
    ansible-playbook milestone2.yml -K --ask-vault-pass
    
### To setup the iTrust Environment
    ansible-playbook setupiTrust.yml -K --ask-vault-pass

#### Jenkins Credentials (Used internally)
    Username: mkd_test1
    Password: mkd_test_passwd_1

#### Vault Password (need to be provided while running the ansible-playbook)
    jenkins

### To setup Checkbox Job and run analysis
    ansible-playbook setupCheckbox.yml -K --ask-vault-pass

### Observations and Report

#### iTrust fuzzer

1. Whenever there is a push to `master` branch of iTrust (forked version), fuzzer is triggered through `prepush` hook
2. iTrust was fuzzed for 100 times over `master` branch which replaces `<` with `>` , `0` with `1`, `""` with `"<random string>"`, `==` with `!=` and vice versa. We ignored the `/model/` and `/sql/` to avoid unnecessary errors since they don't include any logical part required by the project.
3. All 100 builds failed since the modification of condition leads to one or more testcase failures
4. We found around `272` useless test cases (ie) the test cases that passed all the time even after fuzzing

The number of useless test cases mentioned above, significantly dropped from `~700` to `~300` due to large number of Database errors. We observed that such errors were caused due to improper handling of Database connections. Many connections were left open which is evident from the `Too Many Connections` errors. Even after increasing the `max_connections` and `connect_timeout` values in MySQL, these error occurred intermittently. The numbers stabilized at around build #11. 

#### Checkbox code analysis

[Complete report of Detected Items](/useless-test-graph.jpg?raw=true )

The above link is a markdown file that provides the complete report of the Detected Items in the analysis of Checkbox server-side code.


### Team Members and Their Contributions

- Vishal Murugan (vmuruga)
    - Designed the Fuzzer and Useless test case detection programs
    - Integrated Fuzzer and Useless test case detection with the jenkins job

- Dinesh Prasanth M K (dmolugu)
    - Created Ansible Playbook for setting up Jenkins and the environment required for iTrust
    - Created script to commit, revert, push and trigger jenkins build after every fuzzer run

- Manushri (manush)
    - Created Ansible Playbook for setting up Jenkins job and the environment required for Checkbox
    - Created Analysis.js script to implement BigO, SyncCalls, LongMethod Detection.

- Mukundram Muraliram (mmurali5)
    - Created Ansible Playbook for installing and configuring Jenkins required for Checkbox
    - Created function to detect length of the Longest Message Chain
    
## Useless test case graph

![Graph](/useless-test-graph.jpg "Useless test case graph")

